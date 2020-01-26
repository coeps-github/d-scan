declare const jsfeat: any;

class DScan {

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
                const corners = [];
                for (let i = 0; i < imgU8.cols * imgU8.rows; ++i) {
                    corners[i] = new jsfeat.keypoint_t(0, 0, 0, 0);
                }

                // Contrast correction
                const contrast = 20;
                this.applyContrast(imageData, contrast);

                // Canvas update
                context2d.putImageData(imageData, 0, 0);

                // Highpass Filter correction
                const highPassLimit1 = 20;
                this.applyHighPassFilter(imageData, highPassLimit1);

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
                const lowThreshold = 75;
                const highThreshold = 200;
                jsfeat.imgproc.canny(imgU8, imgU8, lowThreshold, highThreshold);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat YAPE06 Corner Detection
                const border = 4;
                jsfeat.yape06.laplacian_threshold = 30;
                jsfeat.yape06.min_eigen_value_threshold = 25;
                const count = jsfeat.yape06.detect(imgU8, corners, border);

                // Find Best Corners
                const maxDistance = 4;
                const highPassLimit2 = 90;
                const bestCorners = this.findCornerPoints(imageData, corners.slice(0, count), maxDistance, highPassLimit2);

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // Print All Corners
                context2d.fillStyle = 'yellow';
                for (let i = 0; i < count; ++i) {
                    const keyPoint = corners[i];
                    context2d.fillRect(keyPoint.x - 2, keyPoint.y - 2, 4, 4);
                }

                // Print Best Corners
                for (let i = 0; i < bestCorners.length; ++i) {
                    const edgePoints = bestCorners[i];
                    context2d.fillStyle = 'red';
                    context2d.fillRect(edgePoints.point1.x - 2, edgePoints.point1.y - 2, 4, 4);
                    context2d.fillRect(edgePoints.point2.x - 2, edgePoints.point2.y - 2, 4, 4);
                    context2d.fillStyle = 'green';
                    context2d.fillRect(edgePoints.midPoint.x - 2, edgePoints.midPoint.y - 2, 4, 4);
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

    private truncateColor(value: number): number {
        if (value < 0) {
            value = 0;
        } else if (value > 255) {
            value = 255;
        }
        return value;
    }

    private findCornerPoints(imageData: ImageData, points: Point[], maxDistance: number, highPassLimit: number): EdgePoints[] {
        const bestCornerPoints = this.findMaxCornerPoints(points);
        return this.findPointsCloseToEdges(imageData, bestCornerPoints, maxDistance, highPassLimit);
    }

    private findMaxCornerPoints(points: Point[]): BestCornerPoints {
        const bestCornerPoints = {
            topLeft: [...points],
            topRight: [...points],
            bottomLeft: [...points],
            bottomRight: [...points],
            length: points.length
        };
        bestCornerPoints.topLeft
            .sort((a, b) => (a.x + a.y) > (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        bestCornerPoints.topRight
            .sort((a, b) => (a.x - a.y) < (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        bestCornerPoints.bottomLeft
            .sort((a, b) => (a.x - a.y) > (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        bestCornerPoints.bottomRight
            .sort((a, b) => (a.x + a.y) < (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        return bestCornerPoints;
    }

    private findPointsCloseToEdges(imageData: ImageData, points: BestCornerPoints, maxDistance: number, highPassLimit: number): EdgePoints[] {
        const left = this.findPointsCloseToEdge(imageData, points.topLeft, points.bottomLeft, points.length, maxDistance, highPassLimit);
        const top = this.findPointsCloseToEdge(imageData, points.topLeft, points.topRight, points.length, maxDistance, highPassLimit);
        const right = this.findPointsCloseToEdge(imageData, points.topRight, points.bottomRight, points.length, maxDistance, highPassLimit);
        const bottom = this.findPointsCloseToEdge(imageData, points.bottomRight, points.bottomLeft, points.length, maxDistance, highPassLimit);
        return [left, top, right, bottom];
    }

    private findPointsCloseToEdge(imageData: ImageData, points1: Point[], points2: Point[], maxIndex: number, maxDistance: number, highPassLimit: number): EdgePoints {
        const indexMods = [
            {i1: 0, i2: 0},
            {i1: 1, i2: 0},
            {i1: 0, i2: 1},
            {i1: 1, i2: 1}
        ];
        for (let pIndex = 0; pIndex < maxIndex; ++pIndex) {
            for (let mIndex = 0; mIndex < 4; ++mIndex) {
                const index1 = pIndex + indexMods[mIndex].i1;
                const index2 = pIndex + indexMods[mIndex].i2;
                const midPoint = this.findPointBetween(points1[index1], points2[index2]);
                if (this.pointIsCloseToEdge(imageData, midPoint, maxDistance, highPassLimit)) {
                    return {
                        point1: points1[index1],
                        point2: points2[index2],
                        midPoint
                    };
                }
            }
        }
        const point1 = points1[0];
        const point2 = points2[0];
        return {
            point1,
            point2,
            midPoint: this.findPointBetween(point1, point2)
        };
    }

    private findPointBetween(point1: Point, point2: Point, location = 0.5): Point {
        return {
            x: Math.round(point1.x + location * (point2.x - point1.x)),
            y: Math.round(point1.y + location * (point2.y - point1.y)),
        };
    }

    private pointIsCloseToEdge(imageData: ImageData, point: Point, maxDistance: number, highPassLimit: number): boolean {
        const limit = 255 * (highPassLimit / 100);
        for (let i = 0; i < maxDistance; ++i) {
            const posX = point.x + i;
            const negX = point.x - i;
            const posY = point.y + i;
            const negY = point.y - i;
            const topLeft = this.getFirstColorIndexForCoord(negX, negY, imageData.width);
            const topRight = this.getFirstColorIndexForCoord(posX, negY, imageData.width);
            const bottomRight = this.getFirstColorIndexForCoord(posX, posY, imageData.width);
            const bottomLeft = this.getFirstColorIndexForCoord(negX, posY, imageData.width);
            const topLeftNormColor = (imageData.data[topLeft] + imageData.data[topLeft + 1] + imageData.data[topLeft + 2]) / 3;
            const topRightNormColor = (imageData.data[topRight] + imageData.data[topRight + 1] + imageData.data[topRight + 2]) / 3;
            const bottomRightNormColor = (imageData.data[bottomRight] + imageData.data[bottomRight + 1] + imageData.data[bottomRight + 2]) / 3;
            const bottomLeftNormColor = (imageData.data[bottomLeft] + imageData.data[bottomLeft + 1] + imageData.data[bottomLeft + 2]) / 3;
            if (topLeftNormColor > limit || topRightNormColor > limit || bottomRightNormColor > limit || bottomLeftNormColor > limit) {
                return true;
            }
        }
        return false;
    }

    private getFirstColorIndexForCoord(x: number, y: number, width: number): number {
        return y * (width * 4) + x * 4;
    }
}

interface Point {
    readonly x: number;
    readonly y: number;
}

interface BestCornerPoints {
    readonly topLeft: Point[];
    readonly topRight: Point[];
    readonly bottomLeft: Point[];
    readonly bottomRight: Point[];
    readonly length: number;
}

interface EdgePoints {
    readonly point1: Point;
    readonly point2: Point;
    readonly midPoint: Point;
}
