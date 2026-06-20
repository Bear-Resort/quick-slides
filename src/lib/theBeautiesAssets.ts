import icon from "../../themes/the-beauties/icon.png";
import pageBg1 from "../../themes/the-beauties/page-bg-1.png";
import pageBg2 from "../../themes/the-beauties/page-bg-2.png";
import pageBg3 from "../../themes/the-beauties/page-bg-3.png";
import titleBg1 from "../../themes/the-beauties/title-bg-1.png";
import titleBg2 from "../../themes/the-beauties/title-bg-2.png";

export const THE_BEAUTIES_ASSETS = {
  icon,
  titleBgs: [titleBg1, titleBg2] as const,
  pageBgs: [pageBg1, pageBg2, pageBg3] as const,
};
