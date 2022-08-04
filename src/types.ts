export type PropertyValue = string | number | Date | boolean | undefined;
export enum PropertyValueType {
  Undefined, // important undefined is 0
  Date,
  String,
  Number,
  Boolean,
}
export type MessageData =
  | { type: "init" }
  | { type: "roundTrip"; args: [{ itemCount: number; seed: number }] }
  | { type: "roundTripRaw"; args: [{ itemCount: number; seed: number }] }
  | { type: "roundTripJson"; args: [{ itemCount: number; seed: number }] };
