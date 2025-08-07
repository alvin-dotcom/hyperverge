import { Configuration, OpenAIApi } from 'openai';
import { CourseDetails, Module } from "@/types/course";

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
);

interface GenerationConfig {
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  numSections?: number;
  numQuestions?: {
    mcq: number;
    saq: number;
  };
}

interface ReviewSuggestion {
  type: 'ambiguity' | 'difficulty' | 'coverage';
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface GenerationResult {
  course: CourseDetails;
  modules: Module[];
  review: {
    suggestions: ReviewSuggestion[];
    bloomCoverage: Record<string, number>;
    difficultyDistribution: Record<string, number>;
  };
}

export const generateCourseContent = async (config: GenerationConfig): Promise<GenerationResult> => {
  try {
    // Generate outline using GPT
    const outline = await generateOutline(config);

    // Generate content for each section
    const contentPromises = outline.sections.map((section: any) =>
      generateSectionContent(config, section)
    );
    const contentResults = await Promise.all(contentPromises);

    // Review the content
    const review = await reviewContent(outline, contentResults);

    return {
      course: outline.course,
      modules: contentResults.map(transformToModule),
      review
    };
  } catch (error) {
    console.error('Error in course generation:', error);
    throw error;
  }
};

// ---------- OpenAI prompt functions ----------

const generateOutline = async (config: GenerationConfig): Promise<any> => {
  const prompt = `Generate a course outline for a topic "${config.topic}" with ${config.numSections || 5} sections. The course should be at a "${config.difficulty}" level. Return an object with a 'course' title and a 'sections' array. Each section should have a 'title' and 'position'.`;

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return JSON.parse(response.data.choices[0].message?.content || '{}');
};

const generateSectionContent = async (config: GenerationConfig, section: any): Promise<any> => {
  const prompt = `Generate detailed content for a course section titled "${section.title}" on topic "${config.topic}". Include text-based content, and ${config.numQuestions?.mcq || 2} multiple-choice questions and ${config.numQuestions?.saq || 1} short-answer questions. Return a JSON object with 'title', 'position', 'items' (array of content blocks with 'title', 'type', 'position', 'content', and optional 'questions').`;

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return JSON.parse(response.data.choices[0].message?.content || '{}');
};

const reviewContent = async (outline: any, content: any): Promise<any> => {
  const prompt = `Review the following course content for ambiguity, difficulty level, and Bloom's taxonomy coverage. Provide review suggestions and coverage breakdowns.

Course Outline:
${JSON.stringify(outline, null, 2)}

Content:
${JSON.stringify(content, null, 2)}

Return a JSON object with:
- suggestions: array of { type, location, description, severity }
- bloomCoverage: object mapping Bloom's levels to percentages
- difficultyDistribution: object mapping difficulty levels to percentages`;

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });

  return JSON.parse(response.data.choices[0].message?.content || '{}');
};

// ---------- Transformers ----------

const transformToModule = (content: any): Module => {
  return {
    id: `module-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: content.title,
    position: content.position,
    items: content.items.map(transformToItem),
    isExpanded: true,
    backgroundColor: '#2d3748',
    isEditing: false
  };
};

const transformToItem = (item: any) => {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: item.title,
    type: item.type,
    position: item.position,
    content: item.content,
    status: 'draft',
    questions: item.questions || []
  };
};
