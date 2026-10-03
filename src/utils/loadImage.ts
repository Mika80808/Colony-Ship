/** 載入一張圖片。各場景共用；失敗時以圖檔路徑作為錯誤訊息。
 *  可傳入預先建好的 Image 元素（RoomScene 的做法），否則自建一個。 */
export function loadImage(src: string, img: HTMLImageElement = new Image()): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}
