---
id: hit-region-keeps-drawn-size
trigger: 'when you enlarge the touch area of a control to reach 44 pt (iOS) or 48 dp (Android)'
confidence: 0.85
domain: frontend
source: host-project-promotion
---

# Grow the touch area, not the drawn control

## Action

Enlarge the area that receives the tap. Keep the drawn button, capsule, chip or icon at its system size.

- **SwiftUI:** a frame or a content shape on the label of a `.bordered` button grows the capsule, because the style draws its background around the label. Use a `ButtonStyle` that wraps the system style, reserves 44 x 44 pt around it, sends a tap in the margin to the same action, and gives the accessibility element a 44 pt frame. A plain row or an icon with nothing drawn behind its label can take the frame on the label.
- **Compose:** keep `Modifier.minimumInteractiveComponentSize()` (Material components apply it), and do not set a smaller `height` or `size` on a chip or an icon button that defeats it.
- Prove it with two checks: a snapshot that shows the control at its system size, and a measure that shows a touch target at the floor.

## Why

A sweep that fixed small touch targets on iOS put the 44 pt frame on the labels. Every bordered button grew into a tall tinted capsule that read as a Material tonal button on iOS. The size gate passed and the screen broke the platform's look.
