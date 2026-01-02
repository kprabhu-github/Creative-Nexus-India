
import { GoogleGenAI } from "@google/genai";
import { CONTRACT_TEXT } from "../constants";

// Following the @google/genai guidelines:
// 1. Use gemini-3-flash-preview for basic text tasks like refinement and Q&A.
// 2. Create a new GoogleGenAI instance right before making an API call.
// 3. Access response.text as a property (not a method).

export const refineScopeWithAI = async (roughInput: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "AI Service Unavailable";
  
  // Create a new instance right before call as per guidelines
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transform the following rough client requirements into a professional "Specific Deliverables" list for a marketing agency contract. 
      Keep it bulleted, clear, and concise.
      
      Rough Input: "${roughInput}"`,
      config: {
        systemInstruction: "You are a professional project manager at a creative agency. Your goal is to write clear Statements of Work.",
      }
    });
    // .text is a property, not a method
    return response.text || "";
  } catch (error) {
    console.error("Error refining scope:", error);
    return "Could not refine text. Please try again.";
  }
};

export const askContractQuestion = async (question: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "AI Service Unavailable";
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Question: "${question}"`,
      config: {
        systemInstruction: `You are a helpful assistant for Creative Nexus India. 
        Answer questions specifically based on the following Service Agreement terms. 
        Be concise and friendly.
        
        AGREEMENT TEXT:
        ${CONTRACT_TEXT}`,
      }
    });
    // .text is a property, not a method
    return response.text || "";
  } catch (error) {
    console.error("Error asking question:", error);
    return "Sorry, I couldn't process your question right now.";
  }
};
