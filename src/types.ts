import { Timer } from "./timings";

export type PropertyValue = string | number | Date | boolean | undefined;
export enum PropertyValueType {
  Undefined, // important undefined is 0
  Date,
  String,
  Number,
  Boolean,
}

type BaseRequestMessageData = { args: [{ itemCount: number; seed: number }] };
export type RequestMessageData =
  | (BaseRequestMessageData &
      (
        | { type: "roundTrip" }
        | { type: "roundTripRaw" }
        | { type: "roundTripJson" }
      ))
  | InitMessage;

export type InitMessage = { type: "init" };

type BaseResponseMessageData = {
  payload: any;
  timings: Timer["timings"];
  messageSendTime: number;
};
export type ResponseMessageData = BaseResponseMessageData &
  (
    | { type: "roundTrip"; args: [{ itemCount: number; seed: number }] }
    | { type: "roundTripRaw"; args: [{ itemCount: number; seed: number }] }
    | { type: "roundTripJson"; args: [{ itemCount: number; seed: number }] }
  );
