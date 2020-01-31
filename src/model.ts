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