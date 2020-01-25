declare const jsfeat: any;

class DScan {
    constructor() {
    }

    scanFromFile(canvas: HTMLCanvasElement, file: File) {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const context2d = canvas.getContext('2d');
        if (context2d) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const imgWidth = img.width;
                const imgHeight = img.height;

                // Canvas init
                context2d.drawImage(img, 0, 0, imgWidth, imgHeight, 0, 0, canvasWidth, canvasHeight);
                const imageData = context2d.getImageData(0, 0, imgWidth, imgHeight);

                // JSFeat init
                const imgU8 = new jsfeat.matrix_t(imgWidth, imgHeight, jsfeat.U8_t | jsfeat.C1_t);

                // JSFeat Grayscale
                const colorGray = jsfeat.COLOR_RGBA2GRAY;
                jsfeat.imgproc.grayscale(imageData.data, imgWidth, imgHeight, imgU8, colorGray);

                // JSFeat Gaussian Blur
                const radius = 2; // 0 - 10
                const kernelSize = (radius + 1) << 1;
                const sigma = 2; // 0 - 10
                jsfeat.imgproc.gaussian_blur(imgU8, imgU8, kernelSize, sigma);

                // Canvas update
                this.updateImageData(imgU8, imageData);
                context2d.putImageData(imageData, 0, 0);
            };
        } else {
            console.error('Failed to get canvas 2d context!');
        }
    }

    scanFromMedia() {
    }

    private updateImageData(imgU8: any, imageData: ImageData) {
        const data_u32 = new Uint32Array(imageData.data.buffer);
        const alpha = (0xff << 24);
        let i = imgU8.cols * imgU8.rows, pix = 0;
        while (--i >= 0) {
            pix = imgU8.data[i];
            data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
        }
    }
}
