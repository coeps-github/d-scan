import {
    applyBrightness,
    applyContrast,
    applyCorrections,
    applyHighPassFilter,
    findBestCornerPoints,
    findMaxCornerPoints,
    imgU8ToImageData
} from "./helpers";

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

                const debug = false;

                // Canvas init
                context2d.drawImage(img, 0, 0, imgWidth, imgHeight, 0, 0, canvasWidth, canvasHeight);
                const imageData = context2d.getImageData(0, 0, calcWidth, calcHeight);

                // JSFeat init
                const imgU8 = new jsfeat.matrix_t(calcWidth, calcHeight, jsfeat.U8_t | jsfeat.C1_t);
                const corners = [];
                for (let i = 0; i < imgU8.cols * imgU8.rows; ++i) {
                    corners[i] = new jsfeat.keypoint_t(0, 0, 0, 0);
                }

                const startTime = Date.now();

                // Contrast correction
                const contrast = 20;
                debug && applyContrast(imageData, contrast);

                // Canvas update
                debug && context2d.putImageData(imageData, 0, 0);

                // Highpass Filter correction
                const highPassLimit1 = 20;
                debug && applyHighPassFilter(imageData, highPassLimit1);

                // Canvas update
                debug && context2d.putImageData(imageData, 0, 0);

                // Brightness correction
                const brightness = 20;
                debug && applyBrightness(imageData, brightness);

                // All Corrections
                !debug && applyCorrections(imageData, contrast, highPassLimit1, brightness);

                // Canvas update
                debug && context2d.putImageData(imageData, 0, 0);

                // JSFeat Grayscale
                const colorGray = jsfeat.COLOR_RGBA2GRAY;
                jsfeat.imgproc.grayscale(imageData.data, calcWidth, calcHeight, imgU8, colorGray);

                // Canvas update
                debug && context2d.putImageData(imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat Gaussian Blur
                const kernelSize = 4;
                const sigma = 50;
                jsfeat.imgproc.gaussian_blur(imgU8, imgU8, kernelSize, sigma);

                // Canvas update
                debug && context2d.putImageData(imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat Canny Edge Detection
                const lowThreshold = 75;
                const highThreshold = 200;
                jsfeat.imgproc.canny(imgU8, imgU8, lowThreshold, highThreshold);

                // Canvas update
                debug && context2d.putImageData(imgU8ToImageData(imgU8, imageData), 0, 0);

                // JSFeat YAPE06 Corner Detection
                const border = 5;
                jsfeat.yape06.laplacian_threshold = 30;
                jsfeat.yape06.min_eigen_value_threshold = 25;
                const count = jsfeat.yape06.detect(imgU8, corners, border);

                // Update ImageData after JSFeat finished updating imgU8
                imgU8ToImageData(imgU8, imageData);

                // Find Max Corner Points
                const pointLimitPerCorner = 4;
                const maxCorners = findMaxCornerPoints(corners.slice(0, count), pointLimitPerCorner);

                // Find Best Corner Points
                const maxDistance = 4;
                const highPassLimit2 = 90;
                const bestCorners = findBestCornerPoints(imageData, maxCorners, maxDistance, highPassLimit2);

                console.log('Time: ' + (Date.now() - startTime));

                // Canvas update
                context2d.putImageData(imgU8ToImageData(imgU8, imageData), 0, 0);

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
                    console.log('Area: ' + cornerPoints.areaSize);
                    if (cornerPoints.allEdges) {
                        context2d.fillStyle = 'red';
                    } else {
                        context2d.fillStyle = 'orange';
                    }
                    context2d.fillRect(cornerPoints.point1.x - 2, cornerPoints.point1.y - 2, 5, 5);
                    context2d.fillRect(cornerPoints.point2.x - 2, cornerPoints.point2.y - 2, 5, 5);
                    context2d.fillRect(cornerPoints.point3.x - 2, cornerPoints.point3.y - 2, 5, 5);
                    context2d.fillRect(cornerPoints.point4.x - 2, cornerPoints.point4.y - 2, 5, 5);
                    cornerPoints.measuredMidPoints.forEach(midPoint => {
                        context2d.fillStyle = 'green';
                        context2d.fillRect(midPoint.point.x - 2, midPoint.point.y - 2, 5, 5);
                        context2d.fillStyle = 'blue';
                        midPoint.midPointMeasurements.forEach(measurement => {
                            context2d.fillRect(measurement.posX, measurement.posY, 1, 1);
                            context2d.fillRect(measurement.posX, measurement.negY, 1, 1);
                            context2d.fillRect(measurement.negX, measurement.posY, 1, 1);
                            context2d.fillRect(measurement.negX, measurement.negY, 1, 1);
                        });
                    });
                });
            };
        } else {
            console.error('Failed to get canvas 2d context!');
        }
    }

    scanFromMedia() {
    }

}
