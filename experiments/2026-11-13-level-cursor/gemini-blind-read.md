### UI Elements & Labels at Left Edge by Frame

* **Frame 1 (~0.00s):**
  * **Vertical scale sidebar:** White strip with level labels and ticks: `lv 5`, `lv 4`, `lv 3`, `lv 2`, `lv 1 · ground`, `lv -1` (orange text), `lv -2`, `lv -3`, `lv -4`.
  * **Slider marker:** Orange pill badge labeled `-1` near `lv 1 · ground`.
  * **Cursor:** Large white closed grabbing hand grasping the marker.
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 2 (~0.35s):**
  * **Vertical scale sidebar:** Same labels and ticks (`lv 5` through `lv -4`).
  * **Slider marker:** Orange `-1` marker positioned midway downward toward `lv -1`.
  * **Cursor:** Large white closed grabbing hand dragging the marker downward.
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 3 (~0.50s):**
  * **Vertical scale sidebar:** Same labels and ticks; orange vertical accent line aligned to `lv -1`.
  * **Slider marker:** Orange `-1` marker arrived at `lv -1`.
  * **Cursor:** Large white closed grabbing hand holding the marker at `lv -1`.
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 4 (~0.65s):**
  * **Left edge:** The white scale sidebar and cursor are completely absent (3D viewport extends to edge).
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 5 (~0.80s):**
  * **Vertical scale sidebar:** Reappears with same labels (`lv 5` through `lv -4`).
  * **Slider marker:** Orange `-1` marker at `lv -1`.
  * **Cursor:** Standard white arrow pointer hovering at the marker.
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 6 (~0.95s):**
  * **Vertical scale sidebar:** Same labels, ticks, and orange `-1` marker resting at `lv -1`.
  * **Cursor:** None visible.
  * **Floating badge:** White pill displaying `Ground → Level -1`.
* **Frame 7 (~1.10s):**
  * **Vertical scale sidebar:** Same labels, ticks, and orange `-1` marker at `lv -1`.
  * **Cursor:** None visible.
  * **Floating badge:** Dimmed / faded grey pill displaying `Ground → Level -1` (fading out).

---

### Questions

1. **Cursor / Hand visibility:**
   * Visible in **Frames 1, 2, and 3** as a hand, and in **Frame 5** as an arrow pointer (no cursor in Frames 4, 6, or 7).
   * It is a **CLOSED grabbing hand** dragging the marker along the vertical scale (not pointing).
2. **Marker movement:**
   * **Yes**, the marker moves **downward** from `lv 1 · ground` (Frame 1) through the midpoint (Frame 2) down to `lv -1` (Frames 3, 5, 6, 7).
3. **'From -> to' text:**
   * **Yes**, `Ground → Level -1` is visible in every frame (Frames 1–7), fading out in Frame 7.
4. **Comprehension score & Most useful fix:**
   * **Score: 7/10.** The `Ground → Level -1` badge and dragging animation make the transition understandable, but the scale completely disappearing in Frame 4, the sudden swap to an arrow cursor, and the faint grey scale text reduce clarity.
   * **Most useful fix:** **Prevent the scale sidebar from vanishing in Frame 4**, keeping it permanently visible with prominent, clickable floor buttons rather than relying on a transient simulated drag gesture.
