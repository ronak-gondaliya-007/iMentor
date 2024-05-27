import { insertOne, find, findOneAndUpdate, updateMany, distinct } from "../utils/db";
import { logger } from "../utils/helpers/logger";
import { error, success } from "../utils/helpers/resSender";
import {
  getCourse,
  getEnrollment
} from '../services/thinkific/thinkific.service';

export let scriptControllors = {
  mongoose: async (req: any, res: any) => {
    await insertOne({
      collection: "Partner",
      document: {
        partnerName: "Test Patner",
        assignedSchoolOrInstitute: ["Harvard University", "Yale University"],
        region: "Region",
      },
    });
    res.send(success("DataEntry Done..."));
  },

  SchoolOrInstitute: async (req: any, res: any) => {
    try {
      await insertOne({
        collection: "AppSetting",
        document: {
          key: "SchoolOrInstitute",
          value: [
            "Harvard University",
            "Stanford University",
            "Massachusetts Institute of Technology (MIT)",
            "California Institute of Technology (Caltech)",
            "Princeton University",
            "Yale University",
            "University of Chicago",
            "Columbia University",
            "University of Pennsylvania",
            "Cornell University",
            "University of California, Berkeley",
            "University of California, Los Angeles (UCLA)",
            "University of Michigan, Ann Arbor",
            "University of Wisconsin-Madison",
            "University of Texas at Austin",
            "Northwestern University",
            "Duke University",
            "Johns Hopkins University",
            "University of Washington",
            "New York University (NYU)",
            "University of North Carolina at Chapel Hill",
            "University of Southern California (USC)",
            "University of Virginia",
            "University of California, San Diego (UCSD)",
            "University of Illinois at Urbana-Champaign",
            "Carnegie Mellon University",
            "University of California, San Francisco (UCSF)",
            "University of Minnesota, Twin Cities",
            "University of Pittsburgh",
            "University of Colorado Boulder",
            "University of Maryland, College Park",
            "University of California, Santa Barbara (UCSB)",
            "University of Florida",
            "University of Arizona",
            "University of Utah",
            "Boston University",
            "Rice University",
            "University of Notre Dame",
            "Georgetown University",
            "Ohio State University, Columbus",
            "Emory University",
            "University of California, Irvine (UCI)",
            "Vanderbilt University",
            "University of California, Davis (UC Davis)",
            "University of Rochester",
            "University of California, Santa Cruz (UCSC)",
            "University of California, Riverside (UCR)",
            "University of Houston",
            "Michigan State University",
            "University of Massachusetts Amherst",
            "University of Georgia",
            "University of Iowa",
            "University of California, Merced (UC Merced)",
            "Indiana University Bloomington",
            "University of Delaware",
            "University of Connecticut",
            "University of Tennessee, Knoxville",
            "University of Alabama",
            "University of Oregon",
            "Purdue University",
            "University of Kentucky",
            "University of Oklahoma",
            "University of South Carolina",
            "Texas A&M University",
            "Arizona State University",
            "University of Arkansas",
            "University of Missouri",
            "University of Nebraska-Lincoln",
            "Iowa State University",
            "University of Vermont",
            "Florida State University",
            "University of New Mexico",
            "University of Mississippi",
            "University of Kansas",
            "Louisiana State University",
            "University of Nevada, Las Vegas (UNLV)",
            "University of Rhode Island",
            "University of Hawaii at Manoa",
            "University of Alaska Fairbanks",
          ],
        },
      });
      res.send(success("Entry Done ... "));
    } catch (err) {
      logger.error("scriptControllors > SchoolOrInstitute ", err);
      res.send(error(err));
    }
  },

  AddChapterIdsIntoAssignedCourses: async (req: any, res: any) => {
    try {
      let assignedCourse = await find({
        collection: 'AssignedCourses',
        project: { _id: 1, courseId: 1 }
      });

      const responseData: any = [];

      for (let i = 0; i < assignedCourse.length; i++) {
        const courseId = assignedCourse[i].courseId;
        let chapterIds: any = [];

        const course = await getCourse(courseId);

        if (course) {
          chapterIds = course.chapter_ids;
        }

        const updatedAssignedCourse = await findOneAndUpdate({
          collection: 'AssignedCourses',
          query: { _id: assignedCourse[i]._id },
          update: { $set: { chapterIds: chapterIds } },
          options: { new: true }
        });

        responseData.push(updatedAssignedCourse);
      }

      res.send(success("Chapter ids added successfully ... ", responseData));
    } catch (err) {
      logger.error("scriptControllors > AddChapterIdsIntoAssignedCourses ", err);
      res.send(error(err));
    }
  },

  AddCourseStautsIntoAssignAndRecommededCourse: async (req: any, res: any) => {
    try {
      const status = 'published';

      const updatedAssignedCourses = await updateMany({
        collection: 'AssignedCourses',
        update: { $set: { courseStatus: status } },
        options: { new: true }
      });

      const updatedRecommendedCourses = await updateMany({
        collection: 'RecommendedCourses',
        update: { $set: { courseStatus: status } },
        options: { new: true }
      });

      const responseData = {
        updatedAssignedCourses,
        updatedRecommendedCourses
      }

      res.send(success("Course status ids added successfully ... ", responseData));
    } catch (err) {
      logger.error("scriptControllors > AddCourseStautsIntoAssignAndRecommededCourse ", err);
      res.send(error(err));
    }
  },

  AddPercentageCompletedIntoRecommededCourse: async (req: any, res: any) => {
    try {
      const recommendedCourses = await find({
        collection: 'RecommendedCourses',
        project: { enrollId: 1 }
      });

      const updatedRecords: any = [];

      for (let i = 0; i < recommendedCourses.length; i++) {
        const enrollmentId = recommendedCourses[i].enrollId;

        if (enrollmentId) {
          console.log('enrollmentId : ', enrollmentId);
          // check is enrollment exists
          const enroll = await getEnrollment(enrollmentId);

          if (enroll) {
            const percentageCompleted = enroll.percentage_completed;

            if (percentageCompleted) {
              const progressInPercentage = (percentageCompleted * 100).toFixed(2);

              // update percentageCompleted into recommended courses collection
              const updatedRecommended = await findOneAndUpdate({
                collection: 'RecommendedCourses',
                query: { enrollId: enrollmentId },
                update: {
                  $set: { percentageCompleted: progressInPercentage }
                },
                options: { new: 1 }
              });

              updatedRecords.push(updatedRecommended);
            }
          }
        }
      }

      res.send(success("Percentage completed added successfully ... ", updatedRecords));
    } catch (err) {
      logger.error("scriptControllors > AddPercentageCompletedIntoRecommededCourse ", err);
      res.send(error(err));
    }
  },

  AddPartnerIdOrRegionIdIntoRecommededCourse: async (req: any, res: any) => {
    try {
      const recommendedCourses = await find({
        collection: 'RecommendedCourses',
        project: { userId: 1, _id: 1 },
        populate: { path: 'userId' }
      });

      const updatedRecords: any = [];

      for (let i = 0; i < recommendedCourses.length; i++) {
        const recommended = recommendedCourses[i];

        if (recommended && recommended.userId) {
          const partnerAdmin = recommended.userId.partnerAdmin;
          const region = recommended.userId.region;
          let partnerIdOrRegionId = recommended.userId.partnerAdmin

          if (!recommended.userId.partnerAdmin) {
            partnerIdOrRegionId = recommended.userId.region;
          }

          // update recommended.userId.region; into recommended courses collection
          const updatedRecommended = await findOneAndUpdate({
            collection: 'RecommendedCourses',
            query: { _id: recommended._id },
            update: {
              $set: {
                partnerIdOrRegionId: partnerIdOrRegionId,
                partnerAdmin: partnerAdmin,
                region: region
              }
            },
            options: { new: 1 }
          });

          updatedRecords.push(updatedRecommended);
        }
      }

      res.send(success("partnerIdOrRegionId added successfully ... ", updatedRecords));
    } catch (err) {
      logger.error("scriptControllors > AddPartnerIdOrRegionIdIntoRecommededCourse ", err);
      res.send(error(err));
    }
  },

  AddContentViewedCountIntoContent: async (req: any, res: any) => {
    try {
      const updatedContent = await updateMany({
        collection: 'Contents',
        query: { 'contentViewedCount': { $exists: false } },
        update: { $set: { contentViewedCount: 0 } },
        options: { new: true }
      });

      const responseData = {
        updatedContent
      }

      res.send(success("Content viewed count added successfully ... ", responseData));
    } catch (err) {
      logger.error("scriptControllors > AddContentViewedCountIntoContent ", err);
      res.send(error(err));
    }
  },

  mentorMatchingQuestionAnswerM2: async (req: any, res: any) => {
    try {
      const answerByMentor = await find({
        collection: 'AnswerByMentors',
        query: {}
      });

      for (let index = 0; index < answerByMentor.length; index++) {
        // for (let index = 0; index < 1; index++) {
        const element = answerByMentor[index];
        console.log("Element=============>", element?._id);

        const transformedArray = element?.queAns?.map((item: any) => {
          console.log("item.question=============>", item);
          if (item !== null && item.question !== undefined) {
            let response = {
              question: item.question,
              answer: item.answer.map((answerValue: any) => {
                if (answerValue.ans == undefined) {
                  return { ans: answerValue }
                } else {
                  return answerValue
                }
              }),
              _id: item._id
            }

            return response;
          } else {
            return item
          }
        });
        console.log("transformedArray", JSON.stringify(transformedArray));


        const updateQuestionAnswer = await findOneAndUpdate({
          collection: 'AnswerByMentors',
          query: { _id: element._id },
          update: { $set: { queAns: transformedArray } },
          options: { new: true }
        });

      }

      return res.send("Success");

    } catch (err) {
      logger.error("scriptControllors > mentorMatchingQuestionAnswerM2 ", err);
      res.send(error(err));
    }
  },

  menteeMatchingQuestionAnswerM2: async (req: any, res: any) => {
    try {
      const answerByMentee = await find({
        collection: 'AnswerByMentee',
        query: {}
      });

      for (let index = 0; index < answerByMentee.length; index++) {
        // for (let index = 0; index < 1; index++) {
        const element = answerByMentee[index];
        console.log("Element=============>", element?._id);

        const transformedArray = element?.queAns?.map((item: any) => {
          if (item !== null && item.question !== undefined) {
            let response = {
              question: item.question,
              answer: item.answer.map((answerValue: any) => {
                if (answerValue.ans == undefined) {
                  return { ans: answerValue }
                } else {
                  return answerValue
                }
              }),
              _id: item._id
            }

            return response;
          } else {
            return item
          }
        });
        console.log("transformedArray", JSON.stringify(transformedArray));


        const updateQuestionAnswer = await findOneAndUpdate({
          collection: 'AnswerByMentee',
          query: { _id: element._id },
          update: { $set: { queAns: transformedArray } },
          options: { new: true }
        });

      }

      return res.send("Success");

    } catch (err) {
      logger.error("scriptControllors > menteeMatchingQuestionAnswerM2 ", err);
      res.send(error(err));
    }
  },

  matchingQuestionAnswerM2: async (req: any, res: any) => {
    try {
      const question = await find({
        collection: 'Matches',
        query: {}
      });
      console.log("question.length=============>", question.length);

      for (let index = 0; index < question.length; index++) {
        // for (let index = 0; index < 1; index++) {
        const element = question[index];

        if (element.question === "Which one of the following careers and jobs are you most interested in?  (Select all that apply) ") {
          const updateQuestionAnswer = await findOneAndUpdate({
            collection: 'Matches',
            query: { _id: element._id },
            update: {
              $set: {
                option: [
                  {
                    "optionNum": 1,
                    "option": "Agriculture & Natural Resources",
                    "subOptions": [
                      "Agricultural Manager",
                      "Agricultural Technician",
                      "Biofuels Specialist",
                      "Geothermal Production Manager",
                      "Botany/Forestry",
                      "Environmental Engineer",
                      "Environmental Scientist/Specialist",
                      "Food Scientists & Technologists",
                      "Horticulture/Agriculture",
                      "Park Management & Conservation",
                      "Refuse & Recycling Management"
                    ],
                  },
                  {
                    "optionNum": 2,
                    "option": "Architecture & Engineering",
                    "subOptions": [
                      "Architect",
                      "Aerospace Engineers",
                      "Automotive Engineer",
                      "Biomedical Engineer",
                      "Chemical Engineer",
                      "Civil Engineer",
                      "Commercial & Industrial Design",
                      "Construction Manager",
                      "Electrical Engineering",
                      "Environmental Engineering",
                      "Interior Designer",
                      "Landscape Architect",
                      "Mechanical Engineering",
                      "Nuclear Engineering",
                      "Robotics Engineers",
                      "Solar Energy Systems Engineer",
                      "Water/Wastewater Engineers",
                      "Wind Energy Engineers"
                    ],
                  },
                  {
                    "optionNum": 3,
                    "option": "Arts & Hospitality",
                    "subOptions": [
                      "Actor",
                      "Art Director",
                      "Athlete/Sports Competitor",
                      "Audio/Visual Technician",
                      "Broadcasting (Radio, TV, Web)",
                      "Culinary Arts/Chef",
                      "Dancer/Choreographer",
                      "Entertainment Manager",
                      "Fashion Designer/Textile Art",
                      "Film/Digital/TV Editor",
                      "Fine Arts, Visual Arts, Graphic Design",
                      "Graphic Designer",
                      "Hotel/Restaurant Management",
                      "Interpreter/Translators",
                      "Music Director/Composer",
                      "Musician/Singer",
                      "Photographer",
                      "Poet/Lyricist/Creative Writer",
                      "Producer/Director",
                      "Reporter/Journalist",
                      "Set/Exhibit Designer",
                      "Special Effects Artists/Animators",
                      "Travel Agent/Guide",
                      "Umpires, Referee, Sports Official"
                    ],
                  },
                  {
                    "optionNum": 4,
                    "option": "Business Management",
                    "subOptions": [
                      "Accountant/Auditor",
                      "Advertising/Marketing Sales",
                      "Agent/Business Manager of Talent",
                      "Consulting",
                      "Entrepreneur",
                      "Facilities Management",
                      "Finance",
                      "Human Resources Manager",
                      "Manufacturing",
                      "Office/Operations Management",
                      "Operations Analyst",
                      "Project Manager",
                      "Purchasing Manager"
                    ],
                  },
                  {
                    "optionNum": 5,
                    "option": "Education & Training",
                    "subOptions": [
                      "Adapted Physical Education Specialist",
                      "Adult Education & Literacy Teacher",
                      "Athletic Trainer",
                      "Coach/Scout",
                      "Pre-K Teacher",
                      "College/University Professor",
                      "Elementary School Teacher",
                      "Middle School Teacher",
                      "Postsecondary Teacher",
                      "Special Education"
                    ],
                  },
                  {
                    "optionNum": 6,
                    "option": "Government",
                    "subOptions": [
                      "Civil Service (Post Office, DMV, etc.)",
                      "Climate Change Analyst",
                      "Energy/Utilities",
                      "Legislator",
                      "Military/Armed Forces",
                      "Public Health",
                      "Public Policy",
                      "Social/Community Service Manager",
                      "Urban & Regional Planner"
                    ],
                  },
                  {
                    "optionNum": 7,
                    "option": "Healthcare",
                    "subOptions": [
                      "Acupuncturist",
                      "Allergist/Immunologist",
                      "Alternative/Complementary Medicine",
                      "Anesthesiologist",
                      "Dentist",
                      "Audiologist",
                      "Cardiologist",
                      "Chiropractic",
                      "Dental Hygienist",
                      "Dermatologist",
                      "Health Management, Policy & Consulting",
                      "Naturopathic Physician",
                      "Medical Doctor",
                      "Mental Health/Social Services",
                      "Neurologist",
                      "Nurse/Nurse Practitioner",
                      "Nutrition & Dietetics",
                      "Obstetrician/Gynecologists",
                      "Occupational Therapy",
                      "Optometry/Ophthalmology",
                      "Pharmaceutical Sales",
                      "Pharmacists",
                      "Physical Therapy",
                      "Psychology/Psychiatry",
                      "Sports Medicine"
                    ],
                  },
                  {
                    "optionNum": 8,
                    "option": "Human Services",
                    "subOptions": [
                      "Fitness Trainer",
                      "Funeral/Crematory/Embalmer",
                      "Human Rights Worker",
                      "Marriage/Family Therapist",
                      "Mental Health Counselor",
                      "Rehabilitation Counselor",
                      "Religious Service",
                      "Social Worker",
                      "Sociologist"
                    ],
                  },
                  {
                    "optionNum": 9,
                    "option": "Information Technology",
                    "subOptions": [
                      "Computer Engineer",
                      "Computer Programmer",
                      "Computer Science",
                      "Computer Security Specialist",
                      "Data Scientist",
                      "Database Administrator",
                      "Network/Systems Administrator",
                      "New Media/Artificial Intelligence",
                      "Software Developer/Engineer",
                      "Telecommunications",
                      "UI/UX - Web design",
                      "Video Game Designer"
                    ],
                  },
                  {
                    "optionNum": 10,
                    "option": "Law & Public Safety",
                    "subOptions": [
                      "Arbitrator/Mediator",
                      "Child/Family/School Social Workers",
                      "Detective/Criminal Investigator",
                      "Emergency Medical Services",
                      "Fire Fighter",
                      "Forensic Science",
                      "Law Enforcement/Criminal Justice",
                      "Lawyer",
                      "Paralegal/Legal Assistant",
                      "Paramedic"
                    ],
                  },
                  {
                    "optionNum": 11,
                    "option": "Marketing",
                    "subOptions": [
                      "Advertising/Promotion Manager",
                      "Market Research Analyst",
                      "Meeting/Convention/Event Planners",
                      "Online Merchant",
                      "Property/Real Estate/Community Managers",
                      "Public Relations Specialist",
                      "Real Estate Broker",
                      "Sales Manager",
                      "Search Marketing Strategist"
                    ],
                  },
                  {
                    "optionNum": 12,
                    "option": "Science & Technology",
                    "subOptions": [
                      "Animal Science/Zoology/Marine Science",
                      "Anthropologist",
                      "Archaeologist",
                      "Artificial Intelligence",
                      "Astronomer",
                      "Biochemist",
                      "Biologist",
                      "Chemist",
                      "Economist",
                      "Environmental Science",
                      "Food Science Technicians",
                      "Forensic Science",
                      "Genetics/Microbiology",
                      "Geographer",
                      "Geoscientist",
                      "Library Science",
                      "Materials Science",
                      "Meteorology",
                      "Physicist",
                      "Researcher",
                      "Zoologist/Wildlife Biologist"
                    ],
                  },
                  {
                    "optionNum": 13,
                    "option": "Trades/Vocations",
                    "subOptions": [
                      "Automotive Mechanic",
                      "Building/Grounds Maintenance",
                      "Carpentry",
                      "Construction",
                      "Midwife",
                      "Customer Service Specialist",
                      "Electrician",
                      "Hairdresser/Hairstylist/Cosmetologist",
                      "Massage Therapist",
                      "Plumbing",
                      "Sailors/Marine Oilers",
                      "Tailor/Seamstress",
                      "Train/Transit Operations",
                      "Watercraft Mechanics/Service"
                    ],
                  },
                ],
              }
            },
            options: { new: true }
          });
        }
      }

      return res.send("Success");

    } catch (err) {
      logger.error("scriptControllors > matchingQuestionAnswerM2 ", err);
      res.send(error(err));
    }
  },

  // careerQuestionAnswerSetEmptyArrayM2: async (req: any, res: any) => {
  //   try {
  //     const question = await distinct({
  //       collection: 'Matches',
  //       field: "_id",
  //       query: { question: "Which one of the following careers and jobs are you most interested in?  (Select all that apply) " }
  //     });
  //     console.log("question=============>", question);
  //     console.log("question.length=============>", question.length);

  //     for (let index = 0; index < question.length; index++) {
  //       const element = question[index];

  //       const answerByMentor = await find({
  //         collection: 'AnswerByMentors',
  //         query: { 'queAns.question': element }
  //       });
  //       console.log("answerByMentor.length=============>", answerByMentor.length);

  //       for (let index = 0; index < 1; index++) {
  //         const element = answerByMentor[index];

  //         element.queAns.map(async (ele: any) => {
  //           if (ele.question?.toString() === element?.toString()) {
  //             console.log("ele", ele);

  //             const update = await findOne({
  //               collection: 'AnswerByMentors',
  //               query: { 'queAns.question': element },
  //             });
  //             console.log("update", update);

  //           }
  //         });

  //       }

  //       // if (answerByMentor.length) {
  //       //   const update = await updateMany({
  //       //     collection: 'AnswerByMentors',
  //       //     query: { 'queAns.question': element },
  //       //     update: { $set: { 'queAns.$.answers': [] } },
  //       //   });
  //       // }

  //     }

  //     for (let index = 0; index < question.length; index++) {
  //       const element = question[index];

  //       const answerByMentee = await find({
  //         collection: 'AnswerByMentee',
  //         query: {}
  //       });
  //       console.log("answerByMentee.length=============>", answerByMentee.length);

  //     }


  //     // console.log("answerByMentor.length=============>", answerByMentor.length);
  //     // console.log("answerByMentee.length=============>", answerByMentee.length);

  //     // for (let index = 0; index < answerByMentor.length; index++) {
  //     //   // for (let index = 0; index < 1; index++) {
  //     //   const element = answerByMentor[index];

  //     //   if (element.question === "Which one of the following careers and jobs are you most interested in?  (Select all that apply) ") {
  //     //     const updateQuestionAnswer = await findOneAndUpdate({
  //     //       collection: 'Matches',
  //     //       query: { _id: element._id },
  //     //       update: {
  //     //         $set: { option: [] }
  //     //       },
  //     //       options: { new: true }
  //     //     });
  //     //   }
  //     // }

  //     return res.send("Success");

  //   } catch (err) {
  //     logger.error("scriptControllors > matchingQuestionAnswerM2 ", err);
  //     res.send(error(err));
  //   }
  // }
};
