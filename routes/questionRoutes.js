import express from "express";
import Question from "../models/questionModel.js";
import mongoose from "mongoose";

const router = express.Router();

router.post("/add-questions", async (req, res) => {
  const questionsData = req.body;
  console.log("🚀 Received request to add questions:", questionsData);

  if (!Array.isArray(questionsData) || questionsData.length === 0) {
    return res.status(400).json({ message: "Invalid input. Please provide an array of questions." });
  }

  try {
    for (const question of questionsData) {
      const { questionText, options, correctAnswer, marks, subjectId, gradeLevelId, difficultyLevel } = question;
      if (!questionText || !options || !Array.isArray(options) || options.length < 2 || !correctAnswer || !marks || !subjectId || !gradeLevelId || !difficultyLevel) {
        return res.status(400).json({ message: "Invalid question format. Each question must have questionText, options (array), correctAnswer, marks, subjectId, gradeLevelId, and difficultyLevel." });
      }
      if (!options.includes(correctAnswer)) {
        return res.status(400).json({ message: `Correct answer "${correctAnswer}" must be one of the provided options: ${options}` });
      }
      if (!["easy", "medium", "hard"].includes(difficultyLevel)) {
        return res.status(400).json({ message: "difficultyLevel must be one of: easy, medium, hard." });
      }
      if (isNaN(marks) || isNaN(subjectId) || isNaN(gradeLevelId)) {
        return res.status(400).json({ message: "Marks, subjectId, and gradeLevelId must be valid numbers." });
      }
    }

    // التحقق من التكرار
    const duplicateQuestions = [];
    const questionsToInsert = [];

    for (const question of questionsData) {
      const existingQuestion = await Question.findOne({
        questionText: question.questionText,
        subjectId: Number(question.subjectId),
        gradeLevelId: Number(question.gradeLevelId),
      });

      if (existingQuestion) {
        duplicateQuestions.push({
          questionText: question.questionText,
          subjectId: question.subjectId,
          gradeLevelId: question.gradeLevelId,
        });
      } else {
        questionsToInsert.push({
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          marks: Number(question.marks),
          subjectId: Number(question.subjectId),
          gradeLevelId: Number(question.gradeLevelId),
          difficultyLevel: question.difficultyLevel,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // إذا كل الأسئلة متكررة
    if (questionsToInsert.length === 0) {
      return res.status(400).json({
        message: "All questions are duplicates and cannot be added.",
        duplicates: duplicateQuestions,
      });
    }

    // إضافة الأسئلة الجديدة فقط
    const insertedQuestions = await Question.insertMany(questionsToInsert);

    // إرجاع الاستجابة مع تفاصيل الأسئلة المضافة والمتكررة
    const response = {
      message: `Successfully added ${insertedQuestions.length} questions!`,
      addedQuestions: insertedQuestions,
    };

    if (duplicateQuestions.length > 0) {
      response.warning = "Some questions were duplicates and not added.";
      response.duplicates = duplicateQuestions;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("❌ Error adding questions:", error.message);
    res.status(500).json({ message: "Error adding questions.", error: error.message });
  }
});

// باقي الروابط (استرجاع، تحديث، حذف) زي ما هي
router.get("/", async (req, res) => {
  const { subjectId, gradeLevelId } = req.query;
  console.log("🚀 Received request to fetch questions:", { subjectId, gradeLevelId });

  try {
    let query = {};
    if (subjectId && !isNaN(subjectId)) query.subjectId = Number(subjectId);
    if (gradeLevelId && !isNaN(gradeLevelId)) query.gradeLevelId = Number(gradeLevelId);

    const questions = await Question.find(query);
    if (questions.length === 0) return res.status(404).json({ message: "No questions found for the given criteria." });
    res.status(200).json({ message: `Successfully retrieved ${questions.length} questions!`, questions });
  } catch (error) {
    console.error("❌ Error retrieving questions:", error.message);
    res.status(500).json({ message: "Error retrieving questions.", error: error.message });
  }
});

router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { questionText, options, correctAnswer, marks, subjectId, gradeLevelId } = req.body;
  console.log("🚀 Received request to update question:", { id, ...req.body });

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid question ID format." });
    const question = await Question.findById(id);
    if (!question) return res.status(404).json({ message: "Question not found." });

    if (questionText && typeof questionText !== "string") return res.status(400).json({ message: "questionText must be a string." });
    if (options && (!Array.isArray(options) || options.length < 2)) return res.status(400).json({ message: "options must be an array with at least 2 options." });
    if (correctAnswer) {
      const optionsToCheck = options || question.options;
      if (!optionsToCheck.includes(correctAnswer)) return res.status(400).json({ message: `Correct answer "${correctAnswer}" must be one of the provided options: ${optionsToCheck}` });
    }
    if (marks && isNaN(marks)) return res.status(400).json({ message: "marks must be a valid number." });
    if (subjectId && isNaN(subjectId)) return res.status(400).json({ message: "subjectId must be a valid number." });
    if (gradeLevelId && isNaN(gradeLevelId)) return res.status(400).json({ message: "gradeLevelId must be a valid number." });

    const updatedData = {
      ...(questionText && { questionText }),
      ...(options && { options }),
      ...(correctAnswer && { correctAnswer }),
      ...(marks && { marks: Number(marks) }),
      ...(subjectId && { subjectId: Number(subjectId) }),
      ...(gradeLevelId && { gradeLevelId: Number(gradeLevelId) }),
      updatedAt: new Date(),
    };

    const updatedQuestion = await Question.findByIdAndUpdate(id, updatedData, { new: true });
    res.status(200).json({ message: "Question updated successfully!", question: updatedQuestion });
  } catch (error) {
    console.error("❌ Error updating question:", error.message);
    res.status(500).json({ message: "Error updating question.", error: error.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  console.log("🚀 Received request to delete question:", { id });

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid question ID format." });
    const question = await Question.findById(id);
    if (!question) return res.status(404).json({ message: "Question not found." });

    await Question.findByIdAndDelete(id);
    res.status(200).json({ message: "Question deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting question:", error.message);
    res.status(500).json({ message: "Error deleting question.", error: error.message });
  }
});

export default router;