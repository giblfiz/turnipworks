"""Small dependency-free UV rasterizer for TRELLIS.2 texture baking.

OpenCV assigns a triangle id to covered texels; PyTorch then computes exact
barycentric positions for those texels on the GPU. This replaces nvdiffrast's
single production-path use without replacing any model inference code.
"""

from __future__ import annotations

import cv2
import numpy as np
import torch


def rasterize_uv_positions(
    uvs: torch.Tensor,
    faces: torch.Tensor,
    vertices: torch.Tensor,
    texture_size: int,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return a texture mask and interpolated 3D position for each covered texel."""
    if texture_size < 2:
        raise ValueError("texture_size must be at least 2")
    device = vertices.device
    uvs_cpu = uvs.detach().float().cpu().numpy()
    faces_cpu = faces.detach().cpu().numpy().astype(np.int64, copy=False)
    triangle_uvs = uvs_cpu[faces_cpu]
    twice_area = (
        (triangle_uvs[:, 1, 0] - triangle_uvs[:, 0, 0])
        * (triangle_uvs[:, 2, 1] - triangle_uvs[:, 0, 1])
        - (triangle_uvs[:, 1, 1] - triangle_uvs[:, 0, 1])
        * (triangle_uvs[:, 2, 0] - triangle_uvs[:, 0, 0])
    )
    valid_faces = np.flatnonzero(np.abs(twice_area) > 1e-12)

    face_image = np.zeros((texture_size, texture_size), dtype=np.int32)
    scale = float(texture_size - 1)
    for face_index in valid_faces:
        polygon = np.rint(triangle_uvs[face_index] * scale).astype(np.int32)
        cv2.fillConvexPoly(face_image, polygon, int(face_index) + 1, lineType=cv2.LINE_8)

    ys, xs = np.nonzero(face_image)
    mask = torch.from_numpy(face_image > 0).to(device=device)
    if len(xs) == 0:
        return mask, vertices.new_empty((0, 3))

    face_ids = torch.from_numpy(face_image[ys, xs].astype(np.int64) - 1).to(device=device)
    points = torch.from_numpy(
        np.stack((xs / scale, ys / scale), axis=1).astype(np.float32)
    ).to(device=device)
    tri_uv = uvs[faces[face_ids]].float()
    a, b, c = tri_uv[:, 0], tri_uv[:, 1], tri_uv[:, 2]
    denominator = (b[:, 1] - c[:, 1]) * (a[:, 0] - c[:, 0]) + (
        c[:, 0] - b[:, 0]
    ) * (a[:, 1] - c[:, 1])
    denominator = torch.where(
        denominator.abs() < 1e-12,
        torch.full_like(denominator, 1e-12),
        denominator,
    )
    w0 = ((b[:, 1] - c[:, 1]) * (points[:, 0] - c[:, 0]) + (
        c[:, 0] - b[:, 0]
    ) * (points[:, 1] - c[:, 1])) / denominator
    w1 = ((c[:, 1] - a[:, 1]) * (points[:, 0] - c[:, 0]) + (
        a[:, 0] - c[:, 0]
    ) * (points[:, 1] - c[:, 1])) / denominator
    weights = torch.stack((w0, w1, 1.0 - w0 - w1), dim=1).clamp_(0.0, 1.0)
    weights /= weights.sum(dim=1, keepdim=True).clamp_min_(1e-12)
    triangle_vertices = vertices[faces[face_ids]]
    positions = (triangle_vertices * weights.to(triangle_vertices.dtype).unsqueeze(-1)).sum(dim=1)
    return mask, positions
