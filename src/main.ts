declare const jsfeat: any;

export class DScan {

    scanFromFile(canvas: HTMLCanvasElement, file: File) {
        const context2d = canvas.getContext('2d');
        if (context2d) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const imgWidth = img.width;
                const imgHeight = img.height;

                const imgRatio = imgHeight / imgWidth;

                const canvasWidth = 200;
                const canvasHeight = 200 * imgRatio;

                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                const calcWidth = canvasWidth;
                const calcHeight = canvasHeight;

                // Canvas init
                context2d.drawImage(img, 0, 0, imgWidth, imgHeight, 0, 0, canvasWidth, canvasHeight);
                const imageData = context2d.getImageData(0, 0, calcWidth, calcHeight);

                const startTime = Date.now();

                // JSFeat init
                const imgU8 = new jsfeat.matrix_t(calcWidth, calcHeight, jsfeat.U8_t | jsfeat.C1_t);
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
                jsfeat.imgproc.grayscale(imageData.data, calcWidth, calcHeight, imgU8, colorGray);

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
                const border = 5;
                jsfeat.yape06.laplacian_threshold = 30;
                jsfeat.yape06.min_eigen_value_threshold = 25;
                const count = jsfeat.yape06.detect(imgU8, corners, border);

                // Find Max Corner Points
                const maxCorners = this.findMaxCornerPoints(corners.slice(0, count));

                // Find Best Corner Points
                const maxDistance = 4;
                const highPassLimit2 = 90;
                const bestCorners = this.findBestCornerPoints(imageData, maxCorners, maxDistance, highPassLimit2);

                console.log('Time: ' + (Date.now() - startTime));

                // Canvas update
                context2d.putImageData(this.imgU8ToImageData(imgU8, imageData), 0, 0);

                // Print All Corners
                context2d.fillStyle = 'yellow';
                for (let i = 0; i < count; ++i) {
                    const keyPoint = corners[i];
                    context2d.fillRect(keyPoint.x - 2, keyPoint.y - 2, 4, 4);
                }

                // Print Max Corner Points
                context2d.fillStyle = 'white';
                context2d.fillRect(maxCorners.topLeft[0].x - 2, maxCorners.topLeft[0].y - 2, 5, 5);
                context2d.fillRect(maxCorners.topRight[0].x - 2, maxCorners.topRight[0].y - 2, 5, 5);
                context2d.fillRect(maxCorners.bottomRight[0].x - 2, maxCorners.bottomRight[0].y - 2, 5, 5);
                context2d.fillRect(maxCorners.bottomLeft[0].x - 2, maxCorners.bottomLeft[0].y - 2, 5, 5);

                // Print Best Corner Points
                bestCorners.forEach(cornerPoints => {
                    if (cornerPoints.bestMatch) {
                        context2d.fillStyle = 'red';
                    } else {
                        context2d.fillStyle = 'orange';
                    }
                    context2d.fillRect(cornerPoints.point1.x - 2, cornerPoints.point1.y - 2, 5, 5);
                    context2d.fillRect(cornerPoints.point2.x - 2, cornerPoints.point2.y - 2, 5, 5);
                    context2d.fillStyle = 'green';
                    context2d.fillRect(cornerPoints.measuredMidPoint.point.x - 2, cornerPoints.measuredMidPoint.point.y - 2, 5, 5);
                    context2d.fillStyle = 'blue';
                    cornerPoints.measuredMidPoint.midPointMeasurements.forEach(measurement => {
                        context2d.fillRect(measurement.posX, measurement.posY, 1, 1);
                        context2d.fillRect(measurement.posX, measurement.negY, 1, 1);
                        context2d.fillRect(measurement.negX, measurement.posY, 1, 1);
                        context2d.fillRect(measurement.negX, measurement.negY, 1, 1);
                    });
                });
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
        let i = imageData.width * imageData.height * 4;
        while ((i = i - 4) >= 0) {
            imageData.data[i] = this.truncateColor(factor * (imageData.data[i] - 128.0) + 128.0);
            imageData.data[i + 1] = this.truncateColor(factor * (imageData.data[i + 1] - 128.0) + 128.0);
            imageData.data[i + 2] = this.truncateColor(factor * (imageData.data[i + 2] - 128.0) + 128.0);
        }
        return imageData;
    }

    private applyHighPassFilter(imageData: ImageData, highPassLimit: number): ImageData {
        const limit = 255 * (highPassLimit / 100);
        let i = imageData.width * imageData.height * 4;
        while ((i = i - 4) >= 0) {
            imageData.data[i] = this.truncateColor(imageData.data[i] < limit ? limit : imageData.data[i]);
            imageData.data[i + 1] = this.truncateColor(imageData.data[i + 1] < limit ? limit : imageData.data[i + 1]);
            imageData.data[i + 2] = this.truncateColor(imageData.data[i + 2] < limit ? limit : imageData.data[i + 2]);
        }
        return imageData;
    }

    private applyBrightness(imageData: ImageData, brightness: number): ImageData {
        const level = 255 * (brightness / 100);
        let i = imageData.width * imageData.height * 4;
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

    private findMaxCornerPoints(points: Point[]): MaxCornerPoints {
        const maxCornerPoints = {
            topLeft: [...points],
            topRight: [...points],
            bottomLeft: [...points],
            bottomRight: [...points],
            length: points.length
        };
        maxCornerPoints.topLeft
            .sort((a, b) => (a.x + a.y) > (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        maxCornerPoints.topRight
            .sort((a, b) => (a.x - a.y) < (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        maxCornerPoints.bottomLeft
            .sort((a, b) => (a.x - a.y) > (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        maxCornerPoints.bottomRight
            .sort((a, b) => (a.x + a.y) < (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1);
        return maxCornerPoints;
    }

    private findBestCornerPoints(imageData: ImageData, points: MaxCornerPoints, maxDistance: number, highPassLimit: number): EdgePoints[] {
        const left = this.findPointsCloseToEdge(imageData, points.topLeft, points.bottomLeft, points.length, maxDistance, highPassLimit);
        const top = this.findPointsCloseToEdge(imageData, points.topLeft, points.topRight, points.length, maxDistance, highPassLimit);
        const right = this.findPointsCloseToEdge(imageData, points.topRight, points.bottomRight, points.length, maxDistance, highPassLimit);
        const bottom = this.findPointsCloseToEdge(imageData, points.bottomRight, points.bottomLeft, points.length, maxDistance, highPassLimit);
        return [...left, ...top, ...right, ...bottom];
    }

    private findPointsCloseToEdge(imageData: ImageData, points1: Point[], points2: Point[], maxIndex: number, maxDistance: number, highPassLimit: number): EdgePoints[] {
        const indexMods = [
            {i1: 0, i2: 0},
            {i1: 1, i2: 0},
            {i1: 0, i2: 1},
            {i1: 1, i2: 1}
        ];
        const edgePoints: EdgePoints[] = [];
        for (let pIndex = 0; pIndex < maxIndex; ++pIndex) {
            for (let mIndex = 0; mIndex < 4; ++mIndex) {
                const index1 = pIndex + indexMods[mIndex].i1;
                const index2 = pIndex + indexMods[mIndex].i2;
                const midPoint = this.findMidPoint(points1[index1], points2[index2]);
                const measuredMidPoint = this.midPointIsCloseToEdge(imageData, midPoint, maxDistance, highPassLimit);
                if (measuredMidPoint.hitEdge) {
                    edgePoints.push({
                        point1: points1[index1],
                        point2: points2[index2],
                        bestMatch: true,
                        measuredMidPoint
                    });
                    return edgePoints;
                } else {
                    edgePoints.push({
                        point1: points1[index1],
                        point2: points2[index2],
                        bestMatch: false,
                        measuredMidPoint
                    });
                }
            }
        }
        const point1 = points1[0];
        const point2 = points2[0];
        edgePoints.push({
            point1,
            point2,
            bestMatch: true,
            measuredMidPoint: {
                point: this.findMidPoint(point1, point2),
                hitEdge: false,
                midPointMeasurements: []
            }
        });
        return edgePoints;
    }

    private findMidPoint(point1: Point, point2: Point, location = 0.5): Point {
        return {
            x: Math.round(point1.x + location * (point2.x - point1.x)),
            y: Math.round(point1.y + location * (point2.y - point1.y)),
        };
    }

    private midPointIsCloseToEdge(imageData: ImageData, point: Point, maxDistance: number, highPassLimit: number): MeasuredMidPoint {
        const limit = 255 * (highPassLimit / 100);
        const midPointMeasurements: MidPointMeasurement[] = [];
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
            midPointMeasurements.push({posX, negX, posY, negY});
            if (topLeftNormColor > limit || topRightNormColor > limit || bottomRightNormColor > limit || bottomLeftNormColor > limit) {
                return {
                    point,
                    hitEdge: true,
                    midPointMeasurements
                };
            }
        }
        return {
            point,
            hitEdge: false,
            midPointMeasurements
        };
    }

    private getFirstColorIndexForCoord(x: number, y: number, width: number): number {
        return y * (width * 4) + x * 4;
    }
}

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface MaxCornerPoints {
    readonly topLeft: Point[];
    readonly topRight: Point[];
    readonly bottomLeft: Point[];
    readonly bottomRight: Point[];
    readonly length: number;
}

export interface EdgePoints {
    readonly point1: Point;
    readonly point2: Point;
    readonly bestMatch: boolean;
    readonly measuredMidPoint: MeasuredMidPoint;
}

export interface MeasuredMidPoint {
    readonly point: Point;
    readonly hitEdge: boolean;
    readonly midPointMeasurements: MidPointMeasurement[];
}

export interface MidPointMeasurement {
    readonly posX: number;
    readonly negX: number;
    readonly posY: number;
    readonly negY: number;
}
