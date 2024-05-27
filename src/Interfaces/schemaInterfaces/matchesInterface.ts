import { Document } from "mongoose";
import { categoryOfQuestion } from "../../utils/const";

export interface matchesInterface extends Document {
  queAndOption: {
    question: string;
    category: string;
    option: [
      {
        optionNum: Number;
        option: String;
      }
    ];
    queType: string;
    required: Boolean;
    status: string;
    weight: string;
    isDraft: Boolean;
    longAnswer: String;
  };
}
