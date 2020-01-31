import {EdgePoints, MaxCornerPoints, MeasuredMidPoint, MidPointMeasurement, Point} from "./model";

export function imgU8ToImageData(imgU8: any, imageData: ImageData): ImageData {
    const data_u32 = new Uint32Array(imageData.data.buffer);
    const alpha = (0xff << 24);
    let i = imgU8.cols * imgU8.rows, pix = 0;
    while (--i >= 0) {
        pix = imgU8.data[i];
        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
    }
    return imageData;
}

export function applyContrast(imageData: ImageData, contrast: number): ImageData {
    const factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
    let i = imageData.width * imageData.height * 4;
    while ((i = i - 4) >= 0) {
        imageData.data[i] = truncateColor(factor * (imageData.data[i] - 128.0) + 128.0);
        imageData.data[i + 1] = truncateColor(factor * (imageData.data[i + 1] - 128.0) + 128.0);
        imageData.data[i + 2] = truncateColor(factor * (imageData.data[i + 2] - 128.0) + 128.0);
    }
    return imageData;
}

export function applyHighPassFilter(imageData: ImageData, highPassLimit: number): ImageData {
    const limit = 255 * (highPassLimit / 100);
    let i = imageData.width * imageData.height * 4;
    while ((i = i - 4) >= 0) {
        imageData.data[i] = truncateColor(imageData.data[i] < limit ? limit : imageData.data[i]);
        imageData.data[i + 1] = truncateColor(imageData.data[i + 1] < limit ? limit : imageData.data[i + 1]);
        imageData.data[i + 2] = truncateColor(imageData.data[i + 2] < limit ? limit : imageData.data[i + 2]);
    }
    return imageData;
}

export function applyBrightness(imageData: ImageData, brightness: number): ImageData {
    const level = 255 * (brightness / 100);
    let i = imageData.width * imageData.height * 4;
    while ((i = i - 4) >= 0) {
        imageData.data[i] = truncateColor(imageData.data[i] + level);
        imageData.data[i + 1] = truncateColor(imageData.data[i + 1] + level);
        imageData.data[i + 2] = truncateColor(imageData.data[i + 2] + level);
    }
    return imageData;
}

export function truncateColor(value: number): number {
    if (value < 0) {
        value = 0;
    } else if (value > 255) {
        value = 255;
    }
    return value;
}

export function findMaxCornerPoints(points: Point[]): MaxCornerPoints {
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

export function findBestCornerPoints(imageData: ImageData, points: MaxCornerPoints, maxDistance: number, highPassLimit: number): EdgePoints[] {
    const left = findPointsCloseToEdge(imageData, points.topLeft, points.bottomLeft, points.length, maxDistance, highPassLimit);
    const top = findPointsCloseToEdge(imageData, points.topLeft, points.topRight, points.length, maxDistance, highPassLimit);
    const right = findPointsCloseToEdge(imageData, points.topRight, points.bottomRight, points.length, maxDistance, highPassLimit);
    const bottom = findPointsCloseToEdge(imageData, points.bottomRight, points.bottomLeft, points.length, maxDistance, highPassLimit);
    return [...left, ...top, ...right, ...bottom];
}

export function findPointsCloseToEdge(imageData: ImageData, points1: Point[], points2: Point[], maxIndex: number, maxDistance: number, highPassLimit: number): EdgePoints[] {
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
            const midPoint = findMidPoint(points1[index1], points2[index2]);
            const measuredMidPoint = midPointIsCloseToEdge(imageData, midPoint, maxDistance, highPassLimit);
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
            point: findMidPoint(point1, point2),
            hitEdge: false,
            midPointMeasurements: []
        }
    });
    return edgePoints;
}

export function findMidPoint(point1: Point, point2: Point, location = 0.5): Point {
    return {
        x: Math.round(point1.x + location * (point2.x - point1.x)),
        y: Math.round(point1.y + location * (point2.y - point1.y)),
    };
}

export function midPointIsCloseToEdge(imageData: ImageData, point: Point, maxDistance: number, highPassLimit: number): MeasuredMidPoint {
    const limit = 255 * (highPassLimit / 100);
    const midPointMeasurements: MidPointMeasurement[] = [];
    for (let i = 0; i < maxDistance; ++i) {
        const posX = point.x + i;
        const negX = point.x - i;
        const posY = point.y + i;
        const negY = point.y - i;
        const topLeft = getFirstColorIndexForCoord(negX, negY, imageData.width);
        const topRight = getFirstColorIndexForCoord(posX, negY, imageData.width);
        const bottomRight = getFirstColorIndexForCoord(posX, posY, imageData.width);
        const bottomLeft = getFirstColorIndexForCoord(negX, posY, imageData.width);
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

export function getFirstColorIndexForCoord(x: number, y: number, width: number): number {
    return y * (width * 4) + x * 4;
}