# Turnip Works — generator / source output-licence audit

**Compiled:** 2026-10-20 by Fauna (Claude substrate). Engineering licence audit, **not legal advice**. Every quote below is verbatim from the fetched primary document, and raw copies were saved in the audit scratchpad on the build box (not committed: they are the vendors' documents). Where a primary page refused the fetch, the mirror used is labelled.

**The question for every section:** may Turnip Works redistribute this source's outputs as part of a **CC BY 4.0** asset library, commercially, worldwide?

**The yardstick: CC BY 4.0 §2(a)(5)(B)** (https://creativecommons.org/licenses/by/4.0/legalcode.en, fetched 2026-10-20):
> "No downstream restrictions. You may not offer or impose any additional or different terms or conditions on, or apply any Effective Technological Measures to, the Licensed Material if doing so restricts exercise of the Licensed Rights by any recipient of the Licensed Material."

An upstream rule can bind us in two ways, and they need different treatment:
- **It binds only us.** Example: "don't train a competing model on the outputs." This is compatible. We comply, and recipients are not bound.
- **It has to follow the asset.** Examples: a territory limit, or a no-training clause we would have to pass on to recipients. This is incompatible with CC BY 4.0's worldwide grant, which cannot carry such terms.

Confidence percentages are my own calibrated estimates that the verdict is right. My measured baseline is weak (72% right / 65% wrong), so read them as rough.

---

## Summary table

| # | Source | Verdict | Conf. | Condition that travels / binds us |
|---|---|---|---|---|
| 1 | OpenAI (gpt-image / ChatGPT / Codex `image_gen`) | **Yes, with conditions** | 85% | Don't represent output as human-made. Sharing policy says disclose AI generation. No competing-model training (binds us only). |
| 2 | Google Gemini image (Nano Banana) via app / API / Antigravity | **Yes, with conditions** | 80% | Google "won't claim ownership" (a non-claim, not an assignment). Don't mislead people into thinking it is human-made. SynthID watermark is embedded; don't strip it. Antigravity third-party-access clause flagged. |
| 3 | Microsoft TRELLIS / TRELLIS.2, self-hosted | **Yes, with conditions** (MIT core). **No** for assets made on the stock reference stack. | 75% | Stock stack runs research-only NVIDIA nvdiffrast/nvdiffrec, Inria Gaussian rasterizer (TRELLIS v1) and BRIA RMBG-2.0 (CC BY-NC). These restrict *use*, not outputs, but producing a commercial library on them is outside their grant. |
| 3b | fal-hosted TRELLIS / TRELLIS.2 | **Yes, with conditions** | 75% | fal marks the endpoint "Commercial use". fal claims no output rights. No training competitors on outputs (binds us). |
| 4 | Tencent Hunyuan3D-2 / 2.1 (self-hosted or via fal) | **No** (worldwide CC BY) | 80% | §5(c) bars distributing or displaying **Output** outside the Territory (EU, UK, South Korea excluded). §5(b) bars using Output to improve other models. CC BY can't carry either restriction. |
| 5 | fal.ai platform | **Yes, with conditions** (neutral pipe) | 70% | ToS is **silent on Output ownership** (no assignment, no claim). Model licences are not passed through expressly; "Third-Party Materials ... may be subject to additional terms". |
| 6a | Meta SAM / SAM 2 | **Yes** | 92% | Apache-2.0. Nothing reaches outputs. |
| 6b | Meta SAM 3 | **Yes, with conditions** | 85% | SAM License: trade-control and prohibited-use terms bind our *use*. No output clause. |
| 6c | BiRefNet | **Yes** | 92% | MIT (code and weights). |
| 6d | BRIA RMBG-2.0 (self-hosted weights) | **No** (unless commercially licensed) | 85% | CC BY-NC 4.0 weights. Commercial use needs a BRIA agreement. Masks produced under NC use taint the provenance. |
| 7a | FLUX.1 [schnell] | **Yes** | 92% | Apache-2.0. |
| 7b | FLUX.1 [dev], self-hosted | **Unclear, leaning No** for production | 70% | The outputs clause permits commercial use of Output. But *running* the model for revenue or "impact on end users" is not a Non-Commercial Purpose. Content filters plus AI disclosure "to the extent required under applicable law". |
| 7c | FLUX.1 [dev] via fal | **Yes, with conditions** | 75% | fal: "suitable for both personal and commercial use through fal.ai's platform". |
| 8a | Meshy, **free** plan | **Yes, with conditions** | 85% | Meshy *owns* free output and licenses it CC BY 4.0. We must credit Meshy and keep the credit in our CC BY notices. Don't strip AI metadata or watermarks. |
| 8b | Meshy, **paid** plan | **Yes, with conditions** | 88% | User owns output. Don't strip AI identifiers. No training competitors (binds us). |
| 9a | Tripo3D, **free** | **No** | 85% | ToS: Tripo "retains all rights" in free users' Outputs. Pricing: "Public Models · Non-Commercial Use". |
| 9b | Tripo3D, **paid** | **Yes, with conditions** | 80% | Paid users "have all rights ... authorize and license". No competing-model use of Outputs (binds us). |
| 10 | ACE-Step (v1 / 1.5) | **Yes** | 85% | Apache-2.0 (v1), MIT (1.5). The non-binding disclaimer "encourages" AI disclosure. HF card lists "Misrepresenting AI-generated music as human-created" as misuse. |
| 11 | Poly Haven / ambientCG | **Yes** | 95% | CC0. Poly Haven's *live API* needs attribution in the product; the assets themselves don't. |
| 12 | Other TRELLIS-path components (DINOv2/v3, rembg/U²-Net, Kaolin, FlexiCubes, CuMesh) | **Yes** | 85% | DINOv3 license: copy of the agreement if we redistribute the *weights*, and trade-control terms. Nothing reaches outputs. |

**Cross-cutting conditions** (cheap to satisfy, and one notice covers almost every row): ship a provenance/AI-disclosure notice with the library, keep embedded AI metadata/C2PA/SynthID where present, credit Meshy on free-plan assets, and keep a per-asset generator record.

---

## 1. OpenAI image generation (gpt-image-1, ChatGPT image gen, Codex CLI `image_gen`)

**Verdict: YES, with conditions. 85%.**

**Which document governs.** Codex CLI signed in with a personal ChatGPT plan falls under the consumer **Terms of Use**. The API (`gpt-image-1` with an API key) or ChatGPT Business/Enterprise falls under the **Services Agreement**. The ownership language is materially identical in both.

**Primary-source fetch status.** openai.com returned HTTP 403 (Cloudflare) to both curl and WebFetch. The texts below are from **Wayback Machine raw captures (mirror)**:
- Terms of Use: https://openai.com/policies/terms-of-use/ via https://web.archive.org/web/20261019203502id_/https://openai.com/policies/terms-of-use/ — "Published: January 1, 2026 / Effective: January 1, 2026"
- Services Agreement: https://openai.com/policies/services-agreement/ via https://web.archive.org/web/20261019185437id_/… — "Effective: January 1, 2026"
- Usage Policies: via https://web.archive.org/web/20261019190145id_/https://openai.com/policies/usage-policies/ — "Effective: October 29, 2025"
- Sharing & Publication Policy: via https://web.archive.org/web/20261012124706id_/https://openai.com/policies/sharing-publication-policy/ — "Updated: November 14, 2022"
- RoW (EEA/CH/UK) Terms of Use: via https://web.archive.org/web/20261017062930id_/https://openai.com/policies/row-terms-of-use/ — "Effective: January 1, 2026". Same ownership and human-generated clauses.

**Terms of Use, "Content":**
> "Ownership of content. As between you and OpenAI, and to the extent permitted by applicable law, you (a) retain your ownership rights in Input and (b) own the Output. We hereby assign to you all our right, title, and interest, if any, in and to Output."

> "Similarity of content. Due to the nature of our Services and artificial intelligence generally, output may not be unique and other users may receive similar output from our Services. Our assignment above does not extend to other users' output or any Third Party Output."

**Terms of Use, "What you cannot do":**
> "Represent that Output was human-generated when it was not."
> "Use Output to develop models that compete with OpenAI."

**Terms of Use, compliance hook:**
> "In using our Services, you must comply with all applicable laws as well as our Sharing & Publication Policy, Usage Policies, and any other documentation, guidelines, or policies we make available to you."

**Services Agreement §4.1:**
> "As between Customer and OpenAI, to the extent permitted by applicable law, Customer: (a) retains all ownership rights in Input; and (b) owns all Output. OpenAI hereby assigns to Customer all OpenAI's right, title, and interest, if any, in and to Output."

**Services Agreement §3.3(e):**
> "(e) except for a Permitted Exception, use Output to develop artificial intelligence models that compete with OpenAI's products and services"

**Sharing & Publication Policy (2022, aimed at social media and text).** It is incorporated by reference above:
> "Indicate that the content is AI-generated in a way no user could reasonably miss or misunderstand."

**Usage Policies (2025-10-29).** I found no image-specific human-made clause; the human-generated prohibition lives in the Terms of Use.

**Territory.** Nothing on outputs. EEA/CH/UK residents get the RoW terms, which carry the same clauses.

**What travels / binds:**
- Binds us: don't claim the assets are human-made, and don't train competing models.
- Neither needs to be imposed on recipients, so it is CC BY-compatible.
- Practical step: disclose AI generation in the library notice.
- "Similarity" means no exclusivity. Someone else may hold a near-identical image.

## 2. Google Gemini image generation (Nano Banana / Gemini 2.5/3 Flash Image) via Gemini app, Gemini API, Antigravity

**Verdict: YES, with conditions. 80%.**

**Which document governs:**
- Gemini app and Antigravity: the **Google Terms of Service**. Antigravity layers its Additional Terms on top.
- Gemini API / AI Studio: the **Gemini API Additional Terms** plus the Google APIs ToS.
- The old "Generative AI Additional Terms" are retired. The page itself says: *"We updated the Google Terms of Service on May 22, 2024 to cover AI-related topics. As of that date, these Generative AI Additional Terms of Service no longer apply, unless you're a business partner with a signed agreement that references these terms."* (https://policies.google.com/terms/generative-ai, "Last Modified: August 9, 2023")

**Google Terms of Service** (https://policies.google.com/terms, "Effective July 30, 2026"):
> "Some of our services allow you to generate original content. Google won't claim ownership over that content. Some content may not be suitable for everyone."

Under abuse examples:
> "misleading others into thinking that generative AI content was created by a human"
> "using AI-generated content from our services to develop machine learning models or related AI technology"

**Gemini API Additional Terms** (https://ai.google.dev/gemini-api/terms, "Effective March 23, 2026"; page "Last updated 2026-04-28 UTC"):
> "Some of our Services allow you to generate original content. Google won't claim ownership over that content. You acknowledge that Google may generate the same or similar content for others and that we reserve all rights to do so."

> "As required by the API Terms, you'll comply with applicable law in using generated content, which may require the provision of attribution to your users when returned as part of an API call. Use discretion before relying on generated content, including code. You're responsible for your use of generated content, and for the use of that content by anyone you share it with."

Territory, which governs the *API client*, not outputs:
> "You may only access the Services (or make API Clients available to users) within an available region. You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom."

**Generative AI Prohibited Use Policy** (https://policies.google.com/terms/generative-ai/use-policy, "Last Modified: December 17, 2024"):
> "Misrepresenting the provenance of generated content by claiming it was created solely by a human, in order to deceive."

**SynthID** (https://ai.google.dev/gemini-api/docs/image-generation, "Last updated 2026-10-09 UTC"):
> "All generated images include a SynthID watermark."

I found **no** term that expressly forbids removing it. The ToS ban on "bypassing our systems or protective measures" is a colourable hook, so don't strip it. Confidence it matters: about 30%.

**Antigravity Additional Terms** (https://antigravity.google/terms, undated page):
> "1. The following documents govern your use of the Service: a. the Google Terms of Service (the "Universal Terms"); b. these Google Antigravity Additional Terms of Service…"

> "6. … Using third party software, tools, or services to access the Service (e.g. using OpenClaw with Antigravity OAuth) is a breach of this Agreement."

This is **an access-method issue, not an output-licence issue.** If `agy-run` drives the official Antigravity CLI, it is fine. If it replays Antigravity OAuth tokens from custom code, that is a ToS exposure. Worth a look. I didn't inspect `agy-run`.

**What travels / binds:**
- Google's "won't claim ownership" is a *non-claim*, not an assignment like OpenAI's. Any rights we have are ours to license, and Google asserts none.
- Binds us: no misleading anyone that the work is human-made, and no ML training on the outputs. Neither is imposed on recipients, so it is CC BY-compatible.
- Keep the SynthID watermark.

## 3. Microsoft TRELLIS and TRELLIS.2 (self-hosted)

**Verdict: YES, with conditions, for the MIT model plus a cleaned dependency path. NO (do not ship) for assets produced on Microsoft's stock reference stack. 75%.**

**Code and weights. MIT:**
- https://github.com/microsoft/TRELLIS/blob/main/LICENSE (last commit `f2dcbf541322`, 2024-12-02) and https://github.com/microsoft/TRELLIS.2/blob/main/LICENSE (`de38fdd40826`, 2025-12-16), both "MIT License / Copyright (c) Microsoft Corporation."
- HF cards: https://huggingface.co/microsoft/TRELLIS-image-large/raw/main/README.md has `license: mit`. https://huggingface.co/microsoft/TRELLIS.2-4B/raw/main/README.md has `license: mit`.
- MIT covers the Software. It says nothing about outputs, and nothing in it reaches generated meshes.

**TRELLIS README** (https://github.com/microsoft/TRELLIS, fetched 2026-10-20):
> "TRELLIS models and the majority of the code are licensed under the MIT License. The following submodules may have different licenses:
> - diffoctreerast … derived from the diff-gaussian-rasterization project and is available under the LICENSE.
> - Modified Flexicubes … licensed under the LICENSE."

**TRELLIS.2 README** (https://github.com/microsoft/TRELLIS.2):
> "This model and code are released under the **MIT License**. Please note that certain dependencies operate under separate license terms:
> - nvdiffrast: Utilized for rendering generated 3D assets. This package is governed by its own License.
> - nvdiffrec: Implements the split-sum renderer for PBR materials. This package is governed by its own License."

**Non-commercial dependencies, and whether they reach outputs.**

*nvdiffrast* (https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt, `1f95925cdad6`, 2020-11-06, "Nvidia Source Code License (1-Way Commercial)"):
> "3.3 Use Limitation. The Work and any derivative works thereof only may be used or intended for use non-commercially. … As used herein, "non-commercially" means for research or evaluation purposes only and not for any direct or indirect monetary gain."

- The licence defines "Work" as the Software and its derivative works. It has **no output clause**, so the meshes are not themselves under this licence.
- But running it to bake a production library is a *use* outside "research or evaluation purposes only".
- That is a breach in how the asset was made, not a licence attached to the asset. Practical risk is low. Provenance cleanliness is poor.
- Where it is used:
  - TRELLIS v1 `trellis/utils/postprocessing_utils.py` does `import nvdiffrast.torch as dr` in the GLB texture-bake path.
  - TRELLIS.2 `o_voxel.postprocess.to_glb` uses it to rasterize UV triangles (per the 2026-09-30 audit in `research/dependency-license-resolution.md`).

*nvdiffrec*, renderutils (https://github.com/NVlabs/nvdiffrec/blob/main/LICENSE.txt, "NVIDIA Source Code License for nvdiffrec"): the same non-commercial structure. TRELLIS.2 uses it only in the env-light preview renderer, not in GLB export.

*Inria/MPII Gaussian-Splatting License.* This covers diff-gaussian-rasterization (via mip-splatting) and diffoctreerast. Sources: https://github.com/graphdeco-inria/diff-gaussian-rasterization/blob/main/LICENSE.md and https://github.com/JeffreyXiang/diffoctreerast/blob/master/LICENSE:
> "The *Software* may be used "non-commercially", i.e., for research and/or evaluation purposes only."
> "THE USER CANNOT USE, EXPLOIT OR DISTRIBUTE THE *SOFTWARE* FOR COMMERCIAL PURPOSES WITHOUT PRIOR AND EXPLICIT CONSENT OF LICENSORS."

**TRELLIS v1 only:** `postprocessing_utils.py` imports `GaussianRenderer`, which lazy-imports `diff_gaussian_rasterization`, to render the multiview images the texture is baked from. So v1 GLB export depends on both NC rasterizers.

*BRIA RMBG-2.0*: see §6d. The stock TRELLIS.2 pipeline loads it for background removal.

*TRELLIS v1 background removal:* `rembg.new_session('u2net')`. rembg is MIT and U²-Net is Apache-2.0. Clean.

**Status per the repo's own 2026-09-30 audit** (`research/dependency-license-resolution.md`):
- The production lane replaces RMBG with MIT BiRefNet.
- The nvdiffrast UV rasterization is replaced by an independently written rasterizer or BSD PyTorch3D.
- nvdiffrec is excluded.
- That path is clean.
- **Any asset produced on the September canary or stock stack (RMBG + nvdiffrast) should be regenerated or excluded from the CC BY library.**

**What travels:** nothing from MIT. The conditions are about *how the asset was made*, so record which worker produced each asset.

### 3b. fal.ai hosted TRELLIS endpoints

**Verdict: YES, with conditions. 75%.**

- https://fal.ai/models/fal-ai/trellis-2 and https://fal.ai/models/fal-ai/trellis (fetched 2026-10-20) both carry the badge "**Commercial use**".
- fal's ToS: see §5.
- Our prior decision (`dependency-license-resolution.md`) relies on fal's representation and treats fal's internal dependency licences as fal's side of the service boundary. I agree that is defensible. If fal's own stack ran nvdiffrast commercially, NVIDIA's claim would run against fal, not against output holders, because the licence has no output clause.

## 4. Tencent Hunyuan3D-2 / 2.1 (Tencent Hunyuan 3D Community License)

**Verdict: NO for a worldwide CC BY 4.0 library. 80%.** At most "yes, with conditions" if Hunyuan outputs were withheld from EU/UK/South Korea distribution, and CC BY cannot do that.

**Documents:**
- https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE ("TENCENT HUNYUAN 3D 2.1 COMMUNITY LICENSE AGREEMENT / Tencent Hunyuan 3D 2.1 Release Date: June 13, 2025"; last commit `82920d643c0d`, 2025-10-17).
- https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE (the 2.0 version, "Release Date: January 21, 2025"; `f8db63096c82`, 2025-10-28). It is textually identical apart from version names, the repo URL in §1.j, and 2.1 adding the "plans to modify" item in §4.
- The HF copies (https://huggingface.co/tencent/Hunyuan3D-2.1/raw/main/LICENSE) differ only in whitespace.

**Territory, header and definition:**
> "THIS LICENSE AGREEMENT DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA AND IS EXPRESSLY LIMITED TO THE TERRITORY, AS DEFINED BELOW."
> "l. "Territory" shall mean the worldwide territory, excluding the territory of the European Union, United Kingdom and South Korea."

**Acceptance via hosted services.** This matters for fal use:
> "By clicking to agree or by using, reproducing, modifying, distributing, performing or displaying any portion or element of the Tencent Hunyuan 3D 2.1 Works, including via any Hosted Service, You will be deemed to have recognized and accepted the content of this Agreement, which is effective immediately."

**Output definition:**
> "h. "Output" shall mean the information and/or content output of Tencent Hunyuan 3D 2.1 or a Model Derivative that results from operating or otherwise using Tencent Hunyuan 3D 2.1 or a Model Derivative, including via a Hosted Service."
> "…For clarity, Outputs by themselves are not deemed Model Derivatives."

**The territory clause reaches OUTPUTS, not just the model (§5(c)):**
> "c. You must not use, reproduce, modify, distribute, or display the Tencent Hunyuan 3D 2.1 Works, Output or results of the Tencent Hunyuan 3D 2.1 Works outside the Territory. Any such use outside the Territory is unlicensed and unauthorized under this Agreement."

**No improving other models with Output (§5(b)):**
> "b. You must not use the Tencent Hunyuan 3D 2.1 Works or any Output or results of the Tencent Hunyuan 3D 2.1 Works to improve any other AI model (other than Tencent Hunyuan 3D 2.1 or Model Derivatives thereof)."

**Pass-through duty (§5(a)).** This covers *Works*, not Outputs:
> "You must include the use restrictions referenced in these Sections 5(a) and 5(b) as an enforceable provision in any agreement … governing the use and/or distribution of Tencent Hunyuan 3D 2.1 Works and You must provide notice to subsequent users to whom You distribute that Tencent Hunyuan 3D 2.1 Works are subject to the use restrictions in these Sections 5(a) and 5(b)."

**Ownership of outputs (§6(d)).** A non-claim, not "you own":
> "d. Tencent claims no rights in Outputs You generate. You and Your users are solely responsible for Outputs and their subsequent uses."

**MAU threshold (§4):**
> "If, on the Tencent Hunyuan 3D 2.1 version release date, the monthly active users of all products or services made available by or for Licensee is greater than 1 million monthly active users in the preceding calendar month, You must request a license from Tencent…"

This is measured at the release date (2025-06-13 or 2025-01-21), so it is irrelevant to us.

**Provider-disclosure duty (§3(e)).** This applies if we "use, integrate, implement, or otherwise deploy the Tencent Hunyuan Works … to provide … any service, product, or functionality to third parties". It requires naming the actual provider and stating that Tencent does not endorse.

**Analysis:**
- §5(c) expressly covers "distribute, or display … Output … outside the Territory". Publishing Hunyuan-derived assets on a public website or repo reachable from the EU/UK/KR is colourably a distribution or display outside the Territory.
- CC BY 4.0 grants recipients a *worldwide* licence and §2(a)(5)(B) bars us from narrowing it. The two can't be reconciled by notice.
- The adverse reading: "Tencent claims no rights in Outputs", so Tencent has no copyright to enforce in outputs and the restriction is contract-only, binding the licensee (us), not recipients.
  - That is a respectable reading, maybe 40–50% to prevail on enforceability.
  - But it still means *we* breach the agreement by publishing worldwide.
  - Practical risk of Tencent ever looking: low, under 5%.
  - The licence-audit answer is still "don't put Hunyuan output in a worldwide CC BY library".
- **fal's "Commercial use permitted" badge** (https://fal.ai/models/fal-ai/hunyuan3d/v2, and https://fal.ai/models/fal-ai/hunyuan3d-v21, which is marked "This endpoint is deprecated") **does not cure the territory or Output clauses.** Tencent's acceptance language reaches users "via any Hosted Service".

**Fix options:** regenerate the Hunyuan assets with TRELLIS.2 (clean path) or Meshy (paid), or keep them out of the public library.

## 5. fal.ai platform Terms of Service

**Verdict: YES, with conditions. fal is a neutral pipe. 70%.**

**Document:** https://fal.ai/terms (served identically at https://fal.ai/legal/terms-of-service), "Last Updated: September 8, 2026".

**Output ownership: silent.** §6(a)–(b) define Output Content but assign ownership only of *Input*:
> "Our Services allow you to submit information, data, text, queries, prompts, media, and other content (collectively, "Customer Input") for use and processing by the AI Features that are part of the Services to generate data, text, sound, video, images, media, or other content ("Output Content") (collectively, "Customer Content")."
> "Subject to the license granted to Company in this Agreement, Customer owns and retains all right, title, and interest in and to the Customer Input."

fal claims ownership only of the Services and "Usage Data" (§6(c), §11). It neither assigns nor claims Output Content. The license to fal in §6(a) covers Customer *Input* only.

§2(c) on Output use:
> "Customer must use the AI Features and the Output Content only (i) in a lawful manner and in compliance with all applicable laws, rules, and regulations and (ii) in a manner (including with respect to any Output Content) that does not infringe or attempt to infringe, misappropriate, or otherwise violate any [third-party rights]… Output Content may not be unique across users…"

**Pass-through of model licences (§14).** There is no express pass-through, only a pointer:
> "Our Services may rely on or interoperate with third-party products and services, including … machine learning models hosted by third parties … ("Third-Party Materials")."
> "Your access to and use of such Third-Party Materials may be subject to additional terms, conditions, and policies (including terms of service or privacy policies of the providers of such Third-Party Materials)."
> "You may not: 1. use or access any Third-Party Materials or any outputs derived from such materials to develop, modify, fine-tune, or improve any products or services that compete with those Third Party Materials, including to develop, fine-tune, or train any artificial intelligence or machine learning algorithms or models; … 3. generate or use content in a way that replicates or closely mimics the original assets used to train any AI incorporated into Third Party Materials."

**Per-model representation:**
- The model pages carry a "Commercial use" badge (TRELLIS, TRELLIS.2, Hunyuan3D, FLUX dev).
- That is a marketing representation, not a licence grant in the ToS. It is reasonable reliance for vendor-boundary purposes.
- It **does not override** a model licence that binds hosted-service users by its own terms (Hunyuan, §4).

**What binds us:**
- No training competing models on outputs.
- Don't mimic training assets.
- Neither travels, so it is CC BY-compatible.

## 6. Segmentation / matting models

### 6a. Meta SAM and SAM 2. **YES. 92%.**
- https://github.com/facebookresearch/segment-anything/blob/main/LICENSE (`571794162e08`, 2023-04-05) and https://github.com/facebookresearch/sam2/blob/main/LICENSE (`0c5f8c54321b`, 2024-07-29): both "Apache License, Version 2.0, January 2004".
- Apache-2.0 governs the Work, not outputs. Nothing travels with masks.

### 6b. Meta SAM 3. **YES, with conditions. 85%.**
https://github.com/facebookresearch/sam3/blob/main/LICENSE (`a13e358df479`): "SAM License / Last Updated: November 19, 2025". It is a custom Meta licence, not Apache:
> "a. Grant of Rights. You are granted a non-exclusive, worldwide, non-transferable and royalty-free limited license under Meta's intellectual property or other rights owned by Meta embodied in the SAM Materials to use, reproduce, distribute, copy, create derivative works of, and make modifications to the SAM Materials."
> "v. You are not the target of Trade Controls and your use of SAM Materials must comply with Trade Controls. You agree not to use, or permit others to use, SAM Materials for any activities subject to the International Traffic in Arms Regulations (ITAR) or end uses prohibited by Trade Controls, including those related to military or warfare purposes, nuclear industries or applications, espionage, or the development or use of guns or illegal weapons."
> "THE SAM MATERIALS AND ANY OUTPUT AND RESULTS THEREFROM ARE PROVIDED ON AN "AS IS" BASIS…"

There is no output-ownership or output-restriction clause. Masks are not "SAM Materials". Only a redistribution of the *weights* would need a copy of the agreement.

### 6c. BiRefNet. **YES. 92%.**
- https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE (`2713d1293ce8`, 2024-03-11): "MIT License / Copyright (c) 2024 ZhengPeng".
- HF card https://huggingface.co/ZhengPeng7/BiRefNet has `license: mit`.

### 6d. BRIA RMBG-2.0. **NO without a commercial agreement. 85%.**
https://huggingface.co/briaai/RMBG-2.0 (gated; the raw README returned 401 and the rendered model page was fetched 2026-10-20; card metadata reads "License: bria-rmbg-2.0"):
> "Bria AI Model weights are open source for non commercial use only, per the provided license."
> "License: Creative Commons Attribution–Non-Commercial (CC BY-NC 4.0)
> - The model is released under a CC BY-NC 4.0 license for non-commercial use.
> - Commercial use is subject to a commercial agreement with BRIA."
> "For production / commercial deployment, use the Bria API — same RMBG-2.0 quality, fully licensed, zero infrastructure"

**Does it reach outputs?**
- CC BY-NC licenses the weights. An alpha matte produced by running them is probably not "Adapted Material" of the weights. Probability that NC "reaches" the mask as a copyright matter: about 20%.
- But the *use* that produced the mask in a commercial pipeline is outside the NC grant.
- Treat any RMBG-masked plate as tainted provenance and regenerate it with BiRefNet. The production lane already did this swap (see §3).

## 7. Black Forest Labs FLUX

### 7a. FLUX.1 [schnell]. **YES. 92%.**
https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-schnell is "Apache License, Version 2.0". The HF card (https://huggingface.co/black-forest-labs/FLUX.1-schnell) returned 401 on the raw fetch, so the GitHub copy is used.

### 7b. FLUX.1 [dev], self-hosted. **UNCLEAR, leaning NO for a production library. 70%.**
https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-dev, "FLUX.1 [dev] Non-Commercial License v1.1.1" (last commit `474dc4205306`, 2025-06-27). The HF copy is gated (401), so the GitHub copy is used.

The outputs clause, §2(d), is the generous part:
> "d. Outputs. We claim no ownership rights in and to the Outputs. You are solely responsible for the Outputs you generate and their subsequent uses in accordance with this License. You may use Output for any purpose (including for commercial purposes), except as expressly prohibited herein. You may not use the Output to train, fine-tune or distill a model that is competitive with the FLUX.1 [dev] Model or the FLUX.1 Kontext [dev] Model."

> "a. "Derivative" means … For the avoidance of doubt, Outputs are not considered Derivatives under this License."

The trap is that *running* the model must itself be a Non-Commercial Purpose (§1(c), §2(b)):
> "c. "Non-Commercial Purpose" means any of the following uses, but only so far as you do not receive any direct or indirect payment arising from the use of the FLUX.1 [dev] Model … (ii) use by commercial or for-profit entities for testing, evaluation, or non-commercial research and development in a non-production environment; … For clarity, use (a) for revenue-generating activity, (b) in direct interactions with or that has impact on end users, or (c) to train, fine tune or distill other models for commercial use, in each case is not a Non-Commercial Purpose."
> "b. Non-Commercial Use Only. You may only access, use, Distribute, or create Derivatives of the FLUX.1 [dev] Model or Derivatives for Non-Commercial Purposes."

Conditions on creating or distributing Output (§2(e)):
> "e. You may access, use, Distribute, or create Output of the FLUX.1 [dev] Model or Derivatives if you: (i) (A) implement and maintain content filtering measures ("Content Filters") … or (B) ensure Output undergoes review for unlawful or infringing content before public or non-public distribution, display, transmission or dissemination; and (ii) ensure Output includes disclosure (or other indication) that the Output was generated or modified using artificial intelligence technologies to the extent required under applicable law."

**Reading.** Bulk-generating a production asset library that ships to end users is colourably "production" use with "impact on end users". The outputs clause lets you *use* outputs commercially, but the generation run itself is outside the grant.
- A hobby, non-revenue reading exists: Turnip Works is unmonetised and the library is free.
- Adverse reading: a product library is production use.
- I'd put the hobby reading at roughly 35%.
- Use schnell, or fal (below), instead.

### 7c. FLUX.1 [dev] via fal. **YES, with conditions. 75%.**
https://fal.ai/models/fal-ai/flux/dev (fetched 2026-10-20):
> "FLUX.1 [dev] is suitable for both personal and commercial use through fal.ai's platform."

The badge also reads "Commercial use". fal is a BFL commercial-licence partner (widely reported, not verified in a primary BFL document here; about 80%).
- Conditions: the §7b output-side terms (no competing-model training; AI disclosure where law requires).
- fal ToS §14 no-compete applies.

## 8. Meshy (meshy.ai)

**Free plan: YES, with conditions. 85%. Paid plan: YES, with conditions. 88%.**

**Document:** https://www.meshy.ai/terms-of-use, "Last Updated: September 19, 2026".

§3.2, free plan. **Meshy owns the output, and you receive it under CC BY 4.0:**
> "Customers using Meshy's Services under the free plan, acknowledge and agree that Meshy owns all right, title, and interest, including all intellectual property rights, in and to the Customer Output and makes such rights available to free plan customers under the Creative Commons Attribution 4.0 International License (the "CC BY 4.0 License"), as long as the free plan customer provides appropriate credit to Meshy."

§3.2, paid plan:
> "Customers on a paid Meshy plan have the option to keep their User Content private … As between Meshy and those Customers on a paid Meshy plan, and to the extent possible under applicable law, such customers on a paid Meshy plan own their Customer Output."

§2.4, AI identifiers. This **travels with the file**:
> "The Service may include machine-readable metadata, digital watermarks, or other identifiers in Customer Output to identify that the Customer Output was generated by AI. You agree not to remove, alter, disable, or otherwise tamper with such identifiers."

§2.6, restriction that binds us:
> "(xi) use generated digital assets to train, develop, or improve AI models that are competitive with Meshy"

§3.3, Community page. This matters if anything was posted there:
> "(a) Customer Output, including 3D models, is licensed under the Creative Commons Zero (CC0) 1.0 Universal Public Domain Dedication …; and (b) all other Community Content, including images You upload, is licensed under the Creative Commons Attribution-NonCommercial 4.0 International license"

Pricing page (https://www.meshy.ai/pricing, fetched 2026-10-20): Free = "CC BY 4.0 license (commercial use with attribution)"; paid tiers = "Private & Customer owned". FAQ: "If you are on a premium plan, you own all assets you create with Meshy. If you are on a free plan, we grant you a CC BY…"

**Analysis:**
- Free-plan assets: we hold them as CC BY 4.0 licensees of Meshy's copyright, to whatever extent it exists.
- We may Share them and our Adapted Material under our own CC BY 4.0. For BY (no ShareAlike), the adapter may license its contributions on any terms.
- **We must retain Meshy's attribution**, e.g. "Generated with Meshy (meshy.ai), CC BY 4.0", in the per-asset or library credits. Fully compatible.
- Both plans: keep glTF/metadata AI identifiers intact through optimisation passes.
- Which plan made which asset needs recording. Paid-plan assets carry no attribution requirement.

## 9. Tripo3D (tripo3d.ai)

**Free: NO. 85%. Paid: YES, with conditions. 80%.**

**Document:** https://www.tripo3d.ai/terms, "Last updated: July 11, 2025". Operator: "Holymolly". No CC BY grant appears anywhere in the ToS. The "free = CC BY" premise is **not** borne out.

§5.2.1, free users:
> "For Users who access and use the Services free of charge ("Free Users"), Tripo retains all rights, including without limitation the rights to use, copy, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, promote, transfer, authorize, license, optimize, derive revenue or other remuneration from, communicate to the public, perform, and display the Inputs and Outputs submitted or generated by Free Users, as well as all Intellectual Property rights arising therefrom."

§5.2.2, paid users:
> "… Paid Users generally have all rights (including but not limited to: use, copy, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, promote, transfer, authorize and license, optimize, derive revenue or other remuneration from, and communicate to the public, perform and display) of the Inputs and Outputs by the paid Users and the Intellectual Property Rights based on the Inputs and Outputs by the paid Users."

§3.2:
> "use Outputs generated by the Services to create models or services that directly compete with Holymolly and its models, products and services. However, that you may use Outputs for lawful commercial or non-commercial purposes, so long as such Outputs are not distributed or made available to third parties in a manner inconsistent with this Agreement or applicable laws;"

Pricing (https://www.tripo3d.ai/pricing, fetched 2026-10-20): Free = "Public Models · Non-Commercial Use"; Pro and above = "Private Models · Commercial Use".

**What travels:** for paid output, nothing beyond "don't build a competing model" (binds us). Free output cannot go into the library.

## 10. ACE-Step (music generation)

**Verdict: YES. 85%.** Confirm which version is installed on the build box (:8001), because v1 and 1.5 have different licences.

**ACE-Step v1:**
- https://github.com/ace-step/ACE-Step/blob/main/LICENSE (`c646e727a614`, 2025-05-04) is Apache-2.0.
- README:
  > "This project is licensed under Apache License 2.0"
  > "To ensure responsible use, we encourage users to verify the originality of generated works, clearly disclose AI involvement, and obtain appropriate permissions when adapting protected styles or materials. By using ACE-Step, you agree to uphold these principles and respect artistic integrity, cultural diversity, and legal compliance."
- HF card https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B has `license: apache-2.0`. Its misuse list includes "Misrepresenting AI-generated music as human-created".

**ACE-Step 1.5:** https://github.com/ace-step/ACE-Step-1.5/blob/main/LICENSE (`910a4dd82aa6`, 2026-01-16) is "MIT License / Copyright (c) 2026 ACEStep".

**What travels:** no output clause. Apache/MIT don't reach generated audio. The "you agree to uphold these principles" sentence sits in a README, not the LICENSE, so it is weakly binding at best. Disclosing AI involvement satisfies it anyway.

## 11. Poly Haven and ambientCG

**Verdict: YES. 95%.** CC0 inputs can be freely included, modified and relicensed inside a CC BY library. Crediting them is courteous, not required.

**Poly Haven** (https://polyhaven.com/license, fetched 2026-10-20; undated page):
> "All assets (HDRIs, textures and 3D models) on this site are the original work of Poly Haven staff, or artists who willingly and directly donate/sell their work to Poly Haven."
> "Our assets are all licensed as CC0, which is effectively Public Domain even in jurisdictions that do not support the Public Domain."
> "You can use our assets for any purpose, including commercial work. / You do not need to give credit or attribution when using them (although it is appreciated). / You can redistribute them, share them around, include them when sharing your own work, or even in a product you sell."

Website ToS §3.2 prohibits "Web scraping or data mining without express permission", so use the API for bulk pulls.

API page (https://polyhaven.com/our-api):
> "If you use the live API in your product, website, or service, make it clear to your users that the assets came from Poly Haven. … This is a condition of using the live API service, not of the assets themselves: the assets are CC0."

**ambientCG** (https://ambientcg.com/license, docs page):
> "All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License. This applies to the downloadable asset files and the material preview renders shown for each asset on the site."
> "You can copy, modify, distribute and perform the assets, even for commercial purposes, all without asking permission."
> "You don't need to give credit but I would of course appreciate it, if you did it anyways."

## 12. Other TRELLIS-path components and Hugging Face cards

**Verdict: YES. 85%.** None reaches outputs.

| Component | Licence (primary URL) | Notes |
|---|---|---|
| `microsoft/TRELLIS-image-large` | `license: mit` (HF card) | Weights MIT. |
| `microsoft/TRELLIS.2-4B` | `license: mit` (HF card) | Weights MIT. |
| DINOv2 (TRELLIS v1 image encoder) | Apache-2.0 (https://github.com/facebookresearch/dinov2/blob/main/LICENSE) | |
| DINOv3 (TRELLIS.2 image encoder, `facebook/dinov3-vitl16-pretrain-lvd1689m`) | "DINOv3 License", "Last Updated: August 19, 2025" (https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md) | See quote below. No output-ownership or output-use clause. |
| rembg | MIT | Used by TRELLIS v1. |
| U²-Net (`u2net` session) | Apache-2.0 | Used by TRELLIS v1. |
| Kaolin | Apache-2.0 | |
| FlexiCubes (nv-tlabs) | Apache-2.0 | |
| CuMesh | MIT | Used by TRELLIS.2. |
| nvdiffrast, nvdiffrec, Inria Gaussian rasterizer | Research-only | See §3. |
| BRIA RMBG-2.0 | CC BY-NC | See §6d. |

DINOv3 licence quote:
> "i. Distribution of DINO Materials, and any derivative works thereof, are subject to the terms of this Agreement. If you distribute or make the DINO Materials, or any derivative works thereof, available to a third party, you may only do so under the terms of this Agreement and you shall provide a copy of this Agreement with any such DINO Materials."

Practical notes:
- The canary used the `camenduru` mirror of DINOv3. The bytes are identical, but production should fetch from Meta's gated repo, per the earlier ledger.
- The pipeline repo should *not* bundle any weights, which matches the Harry 2026-09-30 decision.

---

## Copyrightability of AI outputs (US) and what it means for CC BY

**USCO, *Copyright and Artificial Intelligence, Part 2: Copyrightability*** (January 2025, https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf) concludes:
> "Copyright does not extend to purely AI-generated material, or material where there is insufficient human control over the expressive elements."
> "Based on the functioning of current generally available technology, prompts do not alone provide sufficient control."
> "Human authors are entitled to copyright in their works of authorship that are perceptible in AI-generated outputs, as well as the creative selection, coordination, or arrangement of material in the outputs, or creative modifications of the outputs."

This repeats the 2023 registration guidance (88 FR 16190, effective March 16, 2023, https://www.copyright.gov/ai/ai_policy_guidance.pdf):
> "If a work's traditional elements of authorship were produced by a machine, the work lacks human authorship and the Office will not register it."
> "AI-generated content that is more than de minimis should be explicitly excluded from the application."

The courts agree. *Thaler v. Perlmutter* (D.C. Cir. 2025) affirmed the human-authorship requirement, and the Supreme Court **denied certiorari on March 2, 2026** (No. 25-449; per SCOTUSblog, https://www.scotusblog.com/cases/thaler-v-perlmutter/, a secondary source, about 85%).

**Creative Commons on this point:**
- CC FAQ (https://creativecommons.org/faq/): "CC licenses are operative only when applied to material in which a copyright exists… CC licenses do not contractually impose restrictions on uses of a work where there is no underlying copyright."
- Same FAQ: "You should also not apply Creative Commons licenses to works that are no longer protected by copyright or are otherwise in the public domain. Instead, for those works in the worldwide public domain, we recommend that you mark them with the Public Domain Mark."
- CC's guidance (Kat Walsh, "Understanding CC Licenses and Generative AI", 2023-08-18, https://creativecommons.org/2023/08/18/understanding-cc-licenses-and-generative-ai/): "If you create works using generative AI, you can still apply CC licenses to the work you create with the use of those tools… The CC license you choose will apply to the creative work that you contribute to the final product, even if the portion produced by the generative AI system itself may be uncopyrightable. We encourage the use of CC0 for those works that do not involve a significant degree of human creativity."

**What this means for us:**
- The CC BY 4.0 notice on a purely generated mesh or texture is, in the US, probably a licence over little or nothing. Roughly 80% that a raw prompt-to-asset output has no US copyright.
- The attribution condition is therefore unenforceable as to those elements.
- It *does* bite on our human contributions: curated selection and arrangement of the library, hand edits, kitbashing, retopology choices with creative content, plate art we drew or directed with real control, documentation, and Meshy free-plan assets, where Meshy asserts ownership.
- It may bite in jurisdictions that protect computer-generated works, e.g. UK CDPA §9(3). About 50%, and that provision is under review.
- That is acceptable; CC itself endorses it. But don't represent the library as fully copyright-protected. Consider a one-line notice that AI-generated elements may not be protected and the licence applies to the extent rights exist.

---

## Action list falling out of this audit

1. **Remove or regenerate all Hunyuan3D outputs** (self-hosted or fal) from the public CC BY library. The territory clause reaches Output (§4).
2. **Remove or regenerate assets from the TRELLIS canary/stock stack** (RMBG-2.0 masks, nvdiffrast UV baking, TRELLIS v1 Gaussian-rasterizer bake). Keep the clean BiRefNet plus replacement-rasterizer path, or fal.
3. **Exclude Tripo free-tier outputs**, and any self-hosted FLUX.1 [dev] plates. Use schnell or fal-hosted dev.
4. **Record per-asset provenance:** generator, plan tier (Meshy free/paid, Tripo paid), endpoint (fal vs self-hosted), worker revision.
5. **Credit Meshy on free-plan assets** in the CC BY attribution block.
6. **Ship one AI-provenance notice with the library.** It satisfies the OpenAI ToU and Sharing policy, the Google ToS/PUP, FLUX §2(e)(ii) and the ACE-Step card. Preserve embedded AI metadata, watermarks and SynthID (Meshy §2.4 makes this mandatory).
7. **Check how `agy-run` reaches Antigravity** (Antigravity terms ¶6).

## Fetch log

- Raw copies are in `raw/`.
- OpenAI pages: HTTP 403 direct, so Wayback `id_` raw captures dated 2026-10-12 to 2026-10-19 were used.
- HF raw READMEs for RMBG-2.0 and FLUX.1 [dev]/[schnell]: 401 (gated). The rendered HF page was used for RMBG, and BFL's GitHub `model_licenses/` copies for FLUX.
- Gemini API terms needed a cookie jar (a redirect loop without one).
- Everything else came from the primary URL, fetched 2026-10-20.
