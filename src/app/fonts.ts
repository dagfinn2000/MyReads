import {
  Alegreya,
  Bitter,
  Bodoni_Moda,
  Caveat,
  Cinzel,
  Cormorant_Garamond,
  Crimson_Pro,
  DM_Sans,
  DM_Serif_Display,
  EB_Garamond,
  Figtree,
  Gelasio,
  Josefin_Sans,
  Karla,
  Lexend,
  Libre_Baskerville,
  Lora,
  Manrope,
  Merriweather,
  Newsreader,
  Outfit,
  Quicksand,
  Raleway,
  Roboto_Slab,
  Source_Sans_3,
  Source_Serif_4,
  Space_Mono,
  Vollkorn,
  Work_Sans,
  Young_Serif,
} from "next/font/google";

/*
 * The faces a reader can pick for the app's text, headings and long text
 * (Preferences › Text, lib/fonts.ts), besides the ones the themes already
 * bring (app/layout.tsx). None is preloaded, so a face is only fetched once
 * a reader picks it, or opens the list of them.
 *
 * Variable faces, one file for every weight, so each adds as few rules as
 * it can to the CSS every page loads. Only the serifs most likely to set
 * long text bring their italics (a quote's note is in italic); the others
 * lean their upright letters instead. (next/font wants each call's options
 * written out in full.)
 */
const lexend = Lexend({ subsets: ["latin"], preload: false, variable: "--font-lexend" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], preload: false, variable: "--font-source-sans" });
const workSans = Work_Sans({ subsets: ["latin"], preload: false, variable: "--font-work-sans" });
const dmSans = DM_Sans({ subsets: ["latin"], preload: false, variable: "--font-dm-sans" });
const figtree = Figtree({ subsets: ["latin"], preload: false, variable: "--font-figtree" });
const manrope = Manrope({ subsets: ["latin"], preload: false, variable: "--font-manrope" });
const karla = Karla({ subsets: ["latin"], preload: false, variable: "--font-karla" });
const outfit = Outfit({ subsets: ["latin"], preload: false, variable: "--font-outfit" });
const raleway = Raleway({ subsets: ["latin"], preload: false, variable: "--font-raleway" });
const josefin = Josefin_Sans({ subsets: ["latin"], preload: false, variable: "--font-josefin" });
const quicksand = Quicksand({ subsets: ["latin"], preload: false, variable: "--font-quicksand" });

const lora = Lora({ subsets: ["latin"], style: ["normal", "italic"], preload: false, variable: "--font-lora" });
const merriweather = Merriweather({ subsets: ["latin"], preload: false, variable: "--font-merriweather" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], style: ["normal", "italic"], preload: false, variable: "--font-source-serif" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], style: ["normal", "italic"], preload: false, variable: "--font-eb-garamond" });
const baskerville = Libre_Baskerville({ subsets: ["latin"], style: ["normal", "italic"], preload: false, variable: "--font-baskerville" });
const crimson = Crimson_Pro({ subsets: ["latin"], style: ["normal", "italic"], preload: false, variable: "--font-crimson" });
const newsreader = Newsreader({ subsets: ["latin"], preload: false, variable: "--font-newsreader" });
const alegreya = Alegreya({ subsets: ["latin"], preload: false, variable: "--font-alegreya" });
const vollkorn = Vollkorn({ subsets: ["latin"], preload: false, variable: "--font-vollkorn" });
const gelasio = Gelasio({ subsets: ["latin"], preload: false, variable: "--font-gelasio" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], preload: false, variable: "--font-cormorant" });

const bitter = Bitter({ subsets: ["latin"], preload: false, variable: "--font-bitter" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], preload: false, variable: "--font-roboto-slab" });
const spaceMono = Space_Mono({ subsets: ["latin"], preload: false, weight: ["400", "700"], variable: "--font-space-mono" });
const caveat = Caveat({ subsets: ["latin"], preload: false, variable: "--font-caveat" });

const dmSerif = DM_Serif_Display({ subsets: ["latin"], preload: false, weight: "400", variable: "--font-dm-serif" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], preload: false, variable: "--font-bodoni" });
const youngSerif = Young_Serif({ subsets: ["latin"], preload: false, weight: "400", variable: "--font-young-serif" });
const cinzel = Cinzel({ subsets: ["latin"], preload: false, variable: "--font-cinzel" });

/** Their CSS variables, as classes for <html>. */
export const PICKABLE_FONT_VARIABLES = [
  lexend,
  sourceSans,
  workSans,
  dmSans,
  figtree,
  manrope,
  karla,
  outfit,
  raleway,
  josefin,
  quicksand,
  lora,
  merriweather,
  sourceSerif,
  ebGaramond,
  baskerville,
  crimson,
  newsreader,
  alegreya,
  vollkorn,
  gelasio,
  cormorant,
  bitter,
  robotoSlab,
  spaceMono,
  caveat,
  dmSerif,
  bodoni,
  youngSerif,
  cinzel,
]
  .map((f) => f.variable)
  .join(" ");
