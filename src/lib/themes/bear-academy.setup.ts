import icon from "../../../themes/bear-academy/icon.png";
import pageBg1 from "../../../themes/bear-academy/page-bg-1.png";
import pageBg2 from "../../../themes/bear-academy/page-bg-2.png";
import pageBg3 from "../../../themes/bear-academy/page-bg-3.png";
import titleBg1 from "../../../themes/bear-academy/title-bg-1.png";
import titleBg2 from "../../../themes/bear-academy/title-bg-2.png";
import type { StickerThemeSetup } from "@/lib/themes/types";

/** Bear Academy sticker layout — edit `maxHeight` per image. Stickers sit in a bottom corner. */
export const bearAcademySetup: StickerThemeSetup = {
  id: "bear-academy",
  icon: { file: "icon.png", src: icon },
  stickers: [
    {
      file: "title-bg-1.png",
      src: titleBg1,
      maxHeight: 140,
      layouts: ["title", "subtitle"],
    },
    {
      file: "title-bg-2.png",
      src: titleBg2,
      maxHeight: 140,
      layouts: ["title", "subtitle"],
    },
    {
      file: "page-bg-1.png",
      src: pageBg1,
      maxHeight: 150,
      layouts: ["content"],
    },
    {
      file: "page-bg-2.png",
      src: pageBg2,
      maxHeight: 150,
      layouts: ["content"],
    },
    {
      file: "page-bg-3.png",
      src: pageBg3,
      maxHeight: 150,
      layouts: ["content"],
    },
  ],
};
