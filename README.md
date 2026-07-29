# fonts-converter

An ultra-fast, zero-config web font optimizer that batch-converts TTF or OTF fonts into highly compressed WOFF2 assets. It automatically generates dedicated CSS stylesheets named directly after the short initials (e.g., `PJS.css`), outputs hyper-short filenames (e.g., `PJS_Bd.woff2`), but keeps your `font-family` definitions 100% human-readable inside the CSS file (e.g., `font-family: 'Plus Jakarta Sans'`).

## Installation

```bash
# Run instantly without permanent installation
npx fonts-converter from ttf to woff2

# Or install globally onto your system
npm install -g fonts-converter
```

## Usage

```bash
fonts-converter from ttf to woff2
```

## Output Structure Example

- **Input filename**: `PlusJakartaSans-ExtraLightItalic.ttf`
- **Output asset**: `PJS_Ex_Lt_Ital.woff2`
- **Output stylesheet**: `PJS.css`

### Generated `PJS.css` Result:
```css
@font-face {
  font-family: 'Plus Jakarta Sans';
  src: url('./PJS_Ex_Lt_Ital.woff2') format('woff2');
  font-weight: 200;
  font-style: italic;
  font-display: swap;
}
```
