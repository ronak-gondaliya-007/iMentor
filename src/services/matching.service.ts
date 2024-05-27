import { quentionType } from "../utils/const";

export class Calculate {
  private mentees: any;
  private mentors: any;
  private pairObj: any = { menteeAns: [], mentorAns: [] };
  protected menteeQue: any;
  protected mentorQue: any;
  protected QueLength: number = 0;
  protected score: number = 0;
  protected SOM: number = 0;
  protected Weight: number = 0;

  constructor(mentees: any, mentor: any) {
    this.mentees = mentees;
    this.mentors = mentor;
  }

  async generateScore() {

    for (let idx = 0; idx < this.mentees.queAns.length; idx -= -1) {

      this.menteeQue = this.mentees.queAns[idx];
      if (!this.menteeQue || !this.menteeQue.question || !this.menteeQue.answer || !this.menteeQue.answer.length) {
        continue;
      }
      this.mentorQue = this.mentors?.queAns.find((ele: any) => ele.question?._id?.toString() == this.menteeQue?.question?._id?.toString());
      if (!this.mentorQue || !this.mentorQue.question || !this.mentorQue.answer || !this.mentorQue.answer.length) {
        continue;
      }

      switch (this.menteeQue.question?.queType) {
        case quentionType.MULTI_CHOICE:
        case quentionType.DROP_DOWN_MULTI_SELECT:
          // this.QueLength += 1;
          this.QueLength += this.mentorQue?.question?.weight * 100;
          await this.forMultiChoice();
          break;
        case quentionType.SINGLE_CHOICE:
        case quentionType.DROP_DOWN:
          // this.QueLength += 1;
          this.QueLength += this.mentorQue?.question?.weight * 100;
          await this.forSingleChoice();
          break;
        default:
          console.log("QuestionType Not Found" + this.mentees.queAns[idx]);
          continue;
          break;
      }


      this.pairObj.menteeAns.push({
        question: this.menteeQue?.question?._id,
        option: this.menteeQue?.question?.option.map((ele: any) => {
          if (this.menteeQue?.answer?.some((item: any) => item.ans === ele.option)) {
            ele.answer = true;
            if (this.mentorQue?.answer?.some((item: any) => item.ans === ele.option)) {
              ele.matchAns = true
            }
          }
          return ele;
        }),
        score: this.menteeQue?.question?.option ? Number(this.score?.toString()?.split('.')[0]) === 100 ? Number(this.score.toFixed(0)) : Number(this.score.toFixed(2)) : 0,
      });

      this.pairObj.mentorAns.push({
        question: this.mentorQue?.question?._id,
        option: this.mentorQue?.question?.option?.map((ele: any) => {
          if (this.mentorQue?.answer?.some((item: any) => item.ans === ele.option)) {
            ele.answer = true;
            if (this.menteeQue?.answer?.some((item: any) => item.ans === ele.option)) {
              ele.matchAns = true
            }
          }
          return ele;
        }),
        score: this.mentorQue?.question?.option ? Number(this.score?.toString()?.split('.')[0]) === 100 ? Number(this.score.toFixed(0)) : Number(this.score.toFixed(2)) : 0
      });

      this.SOM += this.score

    }

    this.pairObj.menteeId = this.mentees.user;
    this.pairObj.mentorId = this.mentors.user;
    this.pairObj.SOM = Number.isNaN(Number(this.SOM / this.QueLength)) ? 0 : Number((this.SOM / this.QueLength) * 100).toFixed(2) || 0;

    return this.pairObj;
  }


  async forMultiChoice() {
    // console.log("=================> Multiple <===============");

    this.menteeQue.answer = this.menteeQue.answer.filter((item: any, index: any) => this.menteeQue.answer.indexOf(item) === index)
    this.mentorQue.answer = this.mentorQue.answer.filter((item: any, index: any) => this.mentorQue.answer.indexOf(item) === index)
    this.score = 0;
    // let ratio = (100 / (this.mentorQue.answer.length > this.menteeQue.answer.length === true ? this.mentorQue.answer.length : this.menteeQue.answer.length || 1)).toFixed(2);
    // let count = this.menteeQue?.answer?.filter((ele: any) => this.mentorQue?.answer?.includes(ele)).length;
    let ratio = this.mentorQue.answer.length > this.menteeQue.answer.length ? this.mentorQue.answer.length : this.menteeQue.answer.length;
    let count = (this.menteeQue?.answer || []).filter((ele: any) => {
      return (this.mentorQue?.answer || []).some((item: any) => {
        return item.ans === ele.ans;
      });
    })?.length || 0;
    this.score = Number(((Number(count) / Number(ratio)) * 100 * (this.mentorQue?.question?.weight || 0)))
  }

  async forSingleChoice() {
    this.score = 0;
    if (this.menteeQue?.answer[0].ans == this.mentorQue?.answer[0].ans) {
      this.score = Number((100 * (this.mentorQue?.question?.weight || 0)))
    };
  }

}
