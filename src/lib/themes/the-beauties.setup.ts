import icon from "../../../themes/the-beauties/icon.png";
// import hdPageBg3 from "../../../themes/the-beauties/hd-page-bg-3.png";
// import hdTitleBg2 from "../../../themes/the-beauties/hd-title-bg-2.png";
import pageBg1 from "../../../themes/the-beauties/page-bg-1.png";
import pageBg2 from "../../../themes/the-beauties/page-bg-2.png";
import titleBg1 from "../../../themes/the-beauties/title-bg-1.png";
import type { StickerThemeSetup } from "@/lib/themes/types";

/** The Beauties sticker layout — edit `maxHeight` per image. Stickers sit in a bottom corner. */
export const theBeautiesSetup: StickerThemeSetup = {
  id: "the-beauties",
  icon: { file: "icon.png", src: icon },
  stickers: [
    {
      file: "title-bg-1.png",
      src: titleBg1,
      maxHeight: 220,
      layouts: ["title", "subtitle"],
    },
    // {
    //   file: "hd-title-bg-2.png",
    //   src: hdTitleBg2,
    //   maxHeight: 160,
    //   layouts: ["title", "subtitle"],
    // },
    {
      file: "page-bg-1.png",
      src: pageBg1,
      maxHeight: 180,
      layouts: ["content"],
    },
    {
      file: "page-bg-2.png",
      src: pageBg2,
      maxHeight: 180,
      layouts: ["content"],
    },
    // {
    //   file: "hd-page-bg-3.png",
    //   src: hdPageBg3,
    //   maxHeight: 170,
    //   layouts: ["content"],
    // },
  ],
};
