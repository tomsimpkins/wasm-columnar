import { Timer } from "./timings";

export type PropertyValue = string | number | Date | boolean | undefined;
export enum PropertyValueType {
  Undefined, // important undefined is 0
  Date,
  String,
  Number,
  Boolean,
}

type BaseRequestMessageData = {
  args: [{ itemCount: number; seed: number; types?: PropertyValueType[] }];
};
export type RequestMessageData =
  | (BaseRequestMessageData &
      (
        | { type: "roundTrip" }
        | { type: "roundTripRaw" }
        | { type: "roundTripJson" }
        | { type: "roundTripDict" }
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
    | {
        type: "roundTrip";
      }
    | {
        type: "roundTripRaw";
      }
    | {
        type: "roundTripJson";
      }
    | {
        type: "roundTripDict";
      }
  );
