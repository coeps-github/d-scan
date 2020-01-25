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

                // Contrast correction
                const contrast = 50;
                this.applyContrast(imageData, contrast);

                // Canvas update
                context2d.putImageData(imageData, 0, 0);

                // Highpass Filter correction
                const highPassLimit = 20;
                this.applyHighPassFilter(imageData, highPassLimit);

                // Canvas update
                context2d.putImageData(imageData, 0, 0);

                // Brightness correction
                const brightness = 20;
                this.applyBrightness(imageData, brightness);

                // Canvas update
                context2d.putImageData(imageData, 0, 0);

                // JSFeat Grayscale
                const colorGray = jsfeat.COLOR_RGBA2GRAY;
                jsfeat.imgproc.grayscale(imageData.data, imgWidth, imgHeight, imgU8, colorGray);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat Gaussian Blur
                const kernelSize = 4;
                const sigma = 50;
                jsfeat.imgproc.gaussian_blur(imgU8, imgU8, kernelSize, sigma);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat Canny Edge Detection
                const lowThreshold = 10;
                const highThreshold = 200;
                jsfeat.imgproc.canny(imgU8, imgU8, lowThreshold, highThreshold);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat Fast Corner Detection
                const border = 4;
                jsfeat.yape06.laplacian_threshold = 30;
                jsfeat.yape06.min_eigen_value_threshold = 25;
                let corners = [];
                for (let i = 0; i < imgU8.cols * imgU8.rows; ++i) {
                    corners[i] = new jsfeat.keypoint_t(0, 0, 0, 0);
                }
                const count = jsfeat.yape06.detect(imgU8, corners, border);

                console.log(count);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                context2d.fillStyle = 'red';
                for (let i = 0; i < count; ++i) {
                    const keyPoint = corners[i];
                    context2d.fillRect(keyPoint.x, keyPoint.y, 4, 4);
                }
            };
        } else {
            console.error('Failed to get canvas 2d context!');
        }
    }

    scanFromMedia() {
    }

    private imgU8ToImageData(imgU8: any, imageData: ImageData): ImageData {
        const data_u32 = new Uint32Array(imageData.data.buffer);
        const alpha = (0xff << 24);
        let i = imgU8.cols * imgU8.rows, pix = 0;
        while (--i >= 0) {
            pix = imgU8.data[i];
            data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
        }
        return imageData;
    }

    private applyContrast(imageData: ImageData, contrast: number): ImageData {
        const factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
        let i = imageData.width * imageData.height;
        while ((i = i - 4) >= 0) {
            imageData.data[i] = this.truncateColor(factor * (imageData.data[i] - 128.0) + 128.0);
            imageData.data[i + 1] = this.truncateColor(factor * (imageData.data[i + 1] - 128.0) + 128.0);
            imageData.data[i + 2] = this.truncateColor(factor * (imageData.data[i + 2] - 128.0) + 128.0);
        }
        return imageData;
    }

    private applyHighPassFilter(imageData: ImageData, highPassLimit: number): ImageData {
        const limit = 255 * (highPassLimit / 100);
        let i = imageData.width * imageData.height;
        while ((i = i - 4) >= 0) {
            imageData.data[i] = this.truncateColor(imageData.data[i] < limit ? limit : imageData.data[i]);
            imageData.data[i + 1] = this.truncateColor(imageData.data[i + 1] < limit ? limit : imageData.data[i + 1]);
            imageData.data[i + 2] = this.truncateColor(imageData.data[i + 2] < limit ? limit : imageData.data[i + 2]);
        }
        return imageData;
    }

    private applyBrightness(imageData: ImageData, brightness: number): ImageData {
        const level = 255 * (brightness / 100);
        let i = imageData.width * imageData.height;
        while ((i = i - 4) >= 0) {
            imageData.data[i] = this.truncateColor(imageData.data[i] + level);
            imageData.data[i + 1] = this.truncateColor(imageData.data[i + 1] + level);
            imageData.data[i + 2] = this.truncateColor(imageData.data[i + 2] + level);
        }
        return imageData;
    }

    private truncateColor(value: number) {
        if (value < 0) {
            value = 0;
        } else if (value > 255) {
            value = 255;
        }
        return value;
    }
}
