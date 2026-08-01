# Design

## System
HKBA uses a dark institutional interface with trusted gold and precise cyan accents, crisp cards, restrained gradients, and white content surfaces only where they help logos or uploaded assets read correctly.

## Color
- Canvas: `#06090F`
- Elevated surface: `#0B1120`
- Strong surface: `#101828`
- Text primary: `#E8EDF5`
- Text secondary: `#8896A8`
- Muted text: `#5A6B7F`
- Gold accent: `#D9B656`
- Gold hover: `#B89A3F`
- Cyan interaction: `#67E8F9`
- Success: `#34D399`
- Warning: `#FBBF24`
- Error: `#F87171`

## Typography
Use Inter first, followed by the system UI stack with PingFang SC and Noto Sans SC support. Public pages use compact editorial headings; admin pages use smaller operational headings and stable labels. Letter spacing stays neutral except for short uppercase section labels.

## Components
- Buttons are inline-flex controls with visible hover, focus, and active states.
- Public cards use low-contrast glass surfaces, subtle border lift, and clear content grouping.
- Team cards are structured like professional profile cards: avatar, role badge, name, title, bio.
- Partner logos sit on brighter logo tiles and remain in color.
- Admin navigation uses active indicators, icon containers, and clear top-level actions.

## Layout
Public pages use generous full-width sections with constrained inner content. Admin pages use a sidebar plus wide content canvas, with responsive grids for metrics and work queues.

## Motion
Transitions should be 150-300ms and limited to opacity, transform, border, and background changes. Avoid decorative animation that distracts from reading or content management.
