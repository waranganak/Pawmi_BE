import { Request, Response } from "express"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const chatBot = async (req: Request, resp: Response) => {
  try {
    const { data } = req.body;

    if (!data) {
      return resp.status(400).json({ message: "Prompt data is required" });
    }

    const prompt = `
                    answer the following question if its only about related to animals or else answer not related to this question.

                    The answer should be professional and should complete one.
                    It should sound like a professional and complete related what user asked. use only 800 maximum words and complete the answer

                    Do NOT add explanations, headings, or commentary.
                    Return ONLY the answer.
                    Original question:
                    ${data}
                    `

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text() || "No data";

    console.log("Gemini Success:", generatedContent);

    resp.status(200).json({
      message: "success",
      data: generatedContent,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error.message || error);
    resp.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}