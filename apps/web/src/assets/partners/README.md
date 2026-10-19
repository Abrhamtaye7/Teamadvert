# Partner logos

Logos for the moving "Trusted by" strip on the home page. Add the file here, then list it under
`partners` in `src/content/site.ts`:

```ts
{ name: "Example Bank", url: "https://example.com", logo: "example-bank.svg" },
```

`.svg` is best; `.png` (transparent background) and `.webp` work too. Logos are shown 56 px tall, so
wide logos with little empty space around them look best. A logo with white text needs `dark: true`
so it is shown on a dark tile.
