import { quentionType } from "../utils/const";
import { insertOne } from "../utils/db";
import { logger } from "../utils/helpers/logger";
// import * as tf from "@tensorflow/tfjs";
// import "@tensorflow/tfjs-node";
// import * as use from "@tensorflow-models/universal-sentence-encoder";

//calucalte for options Based on questions
export class Calucalte {
  private mentees: any;
  private mentors: any;
  private questionLen: any;
  private pairObj: any = { menteeAns: [], mentorAns: [] };
  protected menteeQue: any;
  protected mentorQue: any;
  protected score: any;
  protected SOM: any = 0;
  protected Weight: any = 0;

  constructor(mentees: any, mentor: any) {
    this.mentees = mentees;
    this.mentors = mentor;
  }
  async Calculate() {
    for (let idx = 0; idx < this.mentees.queAns.length; idx -= -1) {
      this.menteeQue = this.mentees.queAns[idx];
      this.mentorQue = this.mentors?.queAns.find((ele: any) => {
        return ele.question?.question == this.mentees.queAns[idx]?.question?.question;
      });
      
      switch (this.menteeQue.question?.queType) {
        case quentionType.DROP_DOWN:
        case quentionType.MULTI_CHOICE:
          await this.forMultiChoice();
          break;
        case quentionType.SINGLE_CHOICE:
          await this.forSingleChoice();
          break;
        // case quentionType.SHORT_ANSWER:
        // case quentionType.LONG_ANSWER:
        //   await this.forStringMatching();
        //   break;
        default:
          logger.info("Matching > Service > Constructor > QuestionType Not Found" + this.mentees.queAns[idx]);
          break;
      }
      this.pairObj.menteeAns.push({
        question: this.menteeQue?.question?._id,
        option: this.menteeQue?.question?.option.map((ele: any) => {
          if (this.menteeQue?.answer?.includes(ele.option)) {
            ele.answer = true;
            if (this.mentorQue?.answer?.includes(ele.option)) ele.matchAns = true;
          }

          return ele;
        }),
        score: this.menteeQue?.question?.option ? this.score : 0,
        // SOMScore: ((this.score * this.menteeQue.question.weight) / 100).toFixed(2),
      });
      this.pairObj.mentorAns.push({
        question: this.mentorQue?.question?._id,
        option: this.mentorQue?.question?.option?.map((ele: any) => {
          if (this.mentorQue?.answer?.includes(ele.option)) {
            ele.answer = true;
            if (this.menteeQue?.answer?.includes(ele.option)) ele.matchAns = true;
          }

          return ele;
        }),
        score: this.mentorQue?.question?.option ? this.score : 0,
        // SOMScore: ((this.score * this.mentorQue.question.weight) / 100).toFixed(2),
      });
      await this.countSOM();
    }
    this.pairObj.menteeId = this.mentees.user;
    this.pairObj.mentorId = this.mentors.user;
    this.pairObj.SOM = Number(this.SOM/this.mentees.queAns.length).toFixed(2) || 0;
    return this.pairObj;
  }
  async forMultiChoice() {
    let ratio = (100 / (this.menteeQue?.question?.option?.length || 1)).toFixed(2);
    let count = this.menteeQue?.answer?.filter((ele: any) => this.mentorQue?.answer?.includes(ele)).length;
    this.score = Number(ratio) * Number(count);

  }
  async forSingleChoice() {
    this.score = 0;
    if (this.menteeQue?.answer[0] == this.mentorQue?.answer[0]) this.score = 100;
  }
  
  async countSOM() {
    this.SOM += Number((this.score * (this.mentorQue?.question?.weight || 0)))    
  }
}
