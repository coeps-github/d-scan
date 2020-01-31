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

export function findMaxCornerPoints(points: Point[], pointLimitPerCorner: number): MaxCornerPoints {
    return {
        topLeft: [...points]
            .sort((a, b) => (a.x + a.y) > (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1)
            .filter((_, index) => index < pointLimitPerCorner),
        topRight: [...points]
            .sort((a, b) => (a.x - a.y) < (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1)
            .filter((_, index) => index < pointLimitPerCorner),
        bottomLeft: [...points]
            .sort((a, b) => (a.x - a.y) > (b.x - b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1)
            .filter((_, index) => index < pointLimitPerCorner),
        bottomRight: [...points]
            .sort((a, b) => (a.x + a.y) < (b.x + b.y) ? 1 : a.x === b.x && a.y === b.y ? 0 : -1)
            .filter((_, index) => index < pointLimitPerCorner),
        length: pointLimitPerCorner
    };
}

export const quadIndexTruthTable = [
    {i1: 0, i2: 0, i3: 0, i4: 0},

    {i1: 1, i2: 0, i3: 0, i4: 0},
    {i1: 0, i2: 1, i3: 0, i4: 0},
    {i1: 0, i2: 0, i3: 1, i4: 0},
    {i1: 0, i2: 0, i3: 0, i4: 1},

    {i1: 1, i2: 1, i3: 0, i4: 0},
    {i1: 0, i2: 1, i3: 1, i4: 0},
    {i1: 0, i2: 0, i3: 1, i4: 1},
    {i1: 1, i2: 0, i3: 0, i4: 1},
    {i1: 0, i2: 1, i3: 0, i4: 1},
    {i1: 1, i2: 0, i3: 1, i4: 0},

    {i1: 0, i2: 1, i3: 1, i4: 1},
    {i1: 1, i2: 0, i3: 1, i4: 1},
    {i1: 1, i2: 1, i3: 0, i4: 1},
    {i1: 1, i2: 1, i3: 1, i4: 0},

    {i1: 1, i2: 1, i3: 1, i4: 1}
];

export function findBestCornerPoints(imageData: ImageData, points: MaxCornerPoints, maxDistance: number, highPassLimit: number): EdgePoints[] {
    const points1 = points.topLeft;
    const points2 = points.topRight;
    const points3 = points.bottomRight;
    const points4 = points.bottomLeft;
    const edgePoints: EdgePoints[] = [];
    if (points.length > 1) {
        for (let pIndex = 0; pIndex < points.length - 1; ++pIndex) {
            for (let mIndex = 0; mIndex < 16; ++mIndex) {
                const index1 = pIndex + quadIndexTruthTable[mIndex].i1;
                const index2 = pIndex + quadIndexTruthTable[mIndex].i2;
                const index3 = pIndex + quadIndexTruthTable[mIndex].i3;
                const index4 = pIndex + quadIndexTruthTable[mIndex].i4;
                const midPoint1 = findMidPoint(points1[index1], points2[index2]);
                const midPoint2 = findMidPoint(points2[index2], points3[index3]);
                const midPoint3 = findMidPoint(points3[index3], points4[index4]);
                const midPoint4 = findMidPoint(points4[index4], points1[index1]);
                const measuredMidPoint1 = midPointIsCloseToEdge(imageData, midPoint1, maxDistance, highPassLimit);
                const measuredMidPoint2 = midPointIsCloseToEdge(imageData, midPoint2, maxDistance, highPassLimit);
                const measuredMidPoint3 = midPointIsCloseToEdge(imageData, midPoint3, maxDistance, highPassLimit);
                const measuredMidPoint4 = midPointIsCloseToEdge(imageData, midPoint4, maxDistance, highPassLimit);
                if (measuredMidPoint1.hitEdge && measuredMidPoint2.hitEdge && measuredMidPoint3.hitEdge && measuredMidPoint4.hitEdge) {
                    edgePoints.push({
                        point1: points1[index1],
                        point2: points2[index2],
                        point3: points3[index3],
                        point4: points4[index4],
                        allEdges: true,
                        areaSize: getAreaSize(points1[index1], points2[index2], points3[index3], points4[index4]),
                        measuredMidPoints: [measuredMidPoint1, measuredMidPoint2, measuredMidPoint3, measuredMidPoint4]
                    });
                    return edgePoints;
                } else {
                    edgePoints.push({
                        point1: points1[index1],
                        point2: points2[index2],
                        point3: points3[index3],
                        point4: points4[index4],
                        allEdges: false,
                        areaSize: getAreaSize(points1[index1], points2[index2], points3[index3], points4[index4]),
                        measuredMidPoints: [measuredMidPoint1, measuredMidPoint2, measuredMidPoint3, measuredMidPoint4]
                    });
                }
            }
        }
    }
    edgePoints.push({
        point1: points1[0],
        point2: points2[0],
        point3: points3[0],
        point4: points4[0],
        allEdges: true,
        areaSize: getAreaSize(points1[0], points2[0], points3[0], points4[0]),
        measuredMidPoints: []
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

export function getAreaSize(point1: Point, point2: Point, point3: Point, point4: Point) {
    const xCoords = [point1.x, point2.x, point3.x, point4.x];
    const yCoords = [point1.y, point2.y, point3.y, point4.y];
    const numPoints = 4;
    let area = 0;
    let j = numPoints - 1;
    for (let i = 0; i < numPoints; ++i) {
        area += (xCoords[j] + xCoords[i]) * (yCoords[j] - yCoords[i]);
        j = i;
    }
    return Math.abs(area / 2);
}