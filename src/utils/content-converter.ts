/**
 * Content Converter
 * 
 * Utility functions to convert between Worksheet blocks and Quiz slides
 * Enables bidirectional conversion between the two editor formats
 */

import { 
  Worksheet, 
  WorksheetBlock, 
  BlockType,
  generateBlockId,
  MultipleChoiceContent,
  FreeAnswerContent,
  HeadingContent,
  ParagraphContent,
  InfoboxContent,
  FillBlankContent,
  ExamplesContent,
} from '../types/worksheet';

import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  InfoSlide,
  createEmptyQuiz,
  createABCSlide,
  createOpenSlide,
  createExampleSlide,
  createInfoSlide,
} from '../types/quiz';

// ============================================
// WORKSHEET → BOARD CONVERSION
// ============================================

/**
 * Convert a Worksheet to a Quiz/Board
 */
export function worksheetToBoard(worksheet: Worksheet): Quiz {
  const quiz = createEmptyQuiz(`board-${Date.now()}`);
  
  quiz.title = `${worksheet.title} (Board)`;
  quiz.description = worksheet.description;
  quiz.subject = worksheet.metadata.subject;
  quiz.grade = worksheet.metadata.grade;
  quiz.createdAt = new Date().toISOString();
  quiz.updatedAt = new Date().toISOString();
  
  // Convert blocks to slides
  let order = 0;
  const slides: QuizSlide[] = [];
  
  for (const block of worksheet.blocks) {
    const converted = blockToSlides(block, order);
    for (const slide of converted) {
      slides.push(slide);
      order++;
    }
  }
  
  // Re-assign order numbers
  slides.forEach((slide, idx) => {
    slide.order = idx;
  });
  
  quiz.slides = slides;
  return quiz;
}

/**
 * Convert a single worksheet block to quiz slides (can return multiple for examples)
 */
function blockToSlides(block: WorksheetBlock, startOrder: number): QuizSlide[] {
  switch (block.type) {
    case 'multiple-choice': {
      const content = block.content as MultipleChoiceContent;
      const slide = createABCSlide(startOrder);
      slide.question = content.question || '';
      slide.options = content.options.map((opt, idx) => ({
        id: opt.id,
        label: String.fromCharCode(65 + idx), // A, B, C, D...
        content: opt.text,
        isCorrect: content.correctAnswers.includes(opt.id),
      }));
      slide.explanation = content.explanation;
      return [slide];
    }
    
    case 'free-answer': {
      const content = block.content as FreeAnswerContent;
      const slide = createOpenSlide(startOrder);
      slide.question = content.question || '';
      if (content.sampleAnswer) {
        slide.correctAnswers = [content.sampleAnswer];
      }
      slide.explanation = content.hint;
      return [slide];
    }
    
    case 'fill-blank': {
      const content = block.content as FillBlankContent;
      // Convert fill-blank to open question with the full text
      const slide = createOpenSlide(startOrder);
      
      // Build question text and collect answers
      let questionText = content.instruction ? content.instruction + '\n\n' : '';
      const answers: string[] = [];
      
      for (const segment of content.segments) {
        if (segment.type === 'text') {
          questionText += segment.content;
        } else {
          questionText += '_____';
          answers.push(segment.correctAnswer);
          if (segment.acceptedAnswers) {
            answers.push(...segment.acceptedAnswers);
          }
        }
      }
      
      slide.question = questionText;
      slide.correctAnswers = answers;
      return [slide];
    }
    
    case 'heading': {
      const content = block.content as HeadingContent;
      const slide = createInfoSlide(startOrder);
      slide.title = content.text || '';
      slide.content = '';
      return [slide];
    }
    
    case 'paragraph': {
      const content = block.content as ParagraphContent;
      const slide = createInfoSlide(startOrder);
      slide.title = '';
      slide.content = content.html || '';
      return [slide];
    }
    
    case 'infobox': {
      const content = block.content as InfoboxContent;
      const slide = createInfoSlide(startOrder);
      slide.title = content.title || 'Informace';
      slide.content = content.html || '';
      return [slide];
    }
    
    case 'examples': {
      const content = block.content as ExamplesContent;
      const slides: QuizSlide[] = [];
      
      // Each math example becomes its own Example activity slide
      content.examples.forEach((example, idx) => {
        const slide = createExampleSlide(startOrder + idx);
        slide.title = content.topic || `Příklad ${idx + 1}`;
        slide.problem = example.expression;
        slide.steps = []; // Student solves it themselves
        slide.finalAnswer = example.answer;
        slides.push(slide);
      });
      
      // If no examples but has sample, create one slide from it
      if (slides.length === 0 && content.sampleExample) {
        const slide = createExampleSlide(startOrder);
        slide.title = content.topic || 'Příklad';
        slide.problem = content.sampleExample;
        slide.steps = [];
        slide.finalAnswer = '';
        slides.push(slide);
      }
      
      return slides;
    }
    
    case 'image': {
      // Skip standalone images for now - could be attached to info slides
      return [];
    }
    
    case 'table':
    case 'spacer':
      // Skip these types
      return [];
    
    default:
      return [];
  }
}

// ============================================
// BOARD → WORKSHEET CONVERSION
// ============================================

/**
 * Convert a Quiz/Board to a Worksheet
 */
export function boardToWorksheet(quiz: Quiz): Worksheet {
  const now = new Date().toISOString();
  
  const worksheet: Worksheet = {
    id: `worksheet-${Date.now()}`,
    title: `${quiz.title} (Pracovní list)`,
    description: quiz.description,
    blocks: [],
    metadata: {
      subject: (quiz.subject as any) || 'other',
      grade: (quiz.grade as any) || 6,
      columns: 1,
    },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
  
  // Add title as heading
  const titleBlock: WorksheetBlock = {
    id: generateBlockId(),
    type: 'heading',
    order: 0,
    width: 'full',
    content: {
      text: quiz.title,
      level: 'h1' as const,
    },
  };
  worksheet.blocks.push(titleBlock);
  
  // Convert slides to blocks
  let order = 1;
  for (const slide of quiz.slides) {
    const converted = slideToBlocks(slide, order);
    for (const block of converted) {
      worksheet.blocks.push(block);
      order++;
    }
  }
  
  return worksheet;
}

/**
 * Convert a single quiz slide to worksheet blocks
 */
function slideToBlocks(slide: QuizSlide, startOrder: number): WorksheetBlock[] {
  const blocks: WorksheetBlock[] = [];
  let order = startOrder;
  
  switch (slide.type) {
    case 'activity': {
      const activitySlide = slide as ABCActivitySlide | OpenActivitySlide | ExampleActivitySlide;
      
      if ('activityType' in activitySlide) {
        switch (activitySlide.activityType) {
          case 'abc': {
            const abcSlide = activitySlide as ABCActivitySlide;
            const block: WorksheetBlock = {
              id: generateBlockId(),
              type: 'multiple-choice',
              order: order++,
              width: 'full',
              content: {
                question: abcSlide.question || '',
                options: abcSlide.options.map(opt => ({
                  id: opt.id,
                  text: opt.content,
                })),
                correctAnswers: abcSlide.options
                  .filter(opt => opt.isCorrect)
                  .map(opt => opt.id),
                allowMultiple: abcSlide.options.filter(opt => opt.isCorrect).length > 1,
                explanation: abcSlide.explanation,
              },
            };
            blocks.push(block);
            break;
          }
          
          case 'open': {
            const openSlide = activitySlide as OpenActivitySlide;
            const block: WorksheetBlock = {
              id: generateBlockId(),
              type: 'free-answer',
              order: order++,
              width: 'full',
              content: {
                question: openSlide.question || '',
                lines: 3,
                hint: openSlide.explanation,
                sampleAnswer: openSlide.correctAnswers?.[0],
              },
            };
            blocks.push(block);
            break;
          }
          
          case 'example': {
            const exampleSlide = activitySlide as ExampleActivitySlide;
            
            // Add title as heading
            if (exampleSlide.title) {
              blocks.push({
                id: generateBlockId(),
                type: 'heading',
                order: order++,
                width: 'full',
                content: {
                  text: exampleSlide.title,
                  level: 'h2' as const,
                },
              });
            }
            
            // Add problem as paragraph
            if (exampleSlide.problem) {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p><strong>Zadání:</strong> ${exampleSlide.problem}</p>`,
                },
              });
            }
            
            // Add steps as infobox
            if (exampleSlide.steps.length > 0) {
              const stepsHtml = exampleSlide.steps
                .map((step, idx) => `<p>${idx + 1}. ${step.content}</p>`)
                .join('');
              
              blocks.push({
                id: generateBlockId(),
                type: 'infobox',
                order: order++,
                width: 'full',
                content: {
                  title: 'Postup řešení',
                  html: stepsHtml,
                  variant: 'blue',
                },
              });
            }
            
            // Add final answer
            if (exampleSlide.finalAnswer) {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p><strong>Výsledek:</strong> ${exampleSlide.finalAnswer}</p>`,
                },
              });
            }
            break;
          }
        }
      }
      break;
    }
    
    case 'info': {
      const infoSlide = slide as InfoSlide;
      
      // Add title as heading if present
      if (infoSlide.title) {
        blocks.push({
          id: generateBlockId(),
          type: 'heading',
          order: order++,
          width: 'full',
          content: {
            text: infoSlide.title,
            level: 'h2' as const,
          },
        });
      }
      
      // Add content as paragraph
      if (infoSlide.content) {
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          order: order++,
          width: 'full',
          content: {
            html: infoSlide.content,
          },
        });
      }
      break;
    }
    
    default:
      // Skip unsupported types
      break;
  }
  
  return blocks;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Count convertible blocks in a worksheet
 */
export function countConvertibleBlocks(worksheet: Worksheet): number {
  let count = 0;
  for (const block of worksheet.blocks) {
    if (block.type === 'examples') {
      const content = block.content as ExamplesContent;
      count += content.examples?.length || 1;
    } else if (['multiple-choice', 'free-answer', 'fill-blank', 'heading', 'paragraph', 'infobox'].includes(block.type)) {
      count++;
    }
  }
  return count;
}

/**
 * Count convertible slides in a quiz
 */
export function countConvertibleSlides(quiz: Quiz): number {
  return quiz.slides.length;
}

/**
 * Preview conversion summary
 */
export function getConversionSummary(source: Worksheet | Quiz, direction: 'toBoard' | 'toWorksheet'): {
  totalItems: number;
  convertibleItems: number;
  questions: number;
  infoItems: number;
} {
  if (direction === 'toBoard') {
    const worksheet = source as Worksheet;
    let questions = 0;
    let info = 0;
    
    for (const block of worksheet.blocks) {
      if (['multiple-choice', 'free-answer', 'fill-blank'].includes(block.type)) {
        questions++;
      } else if (block.type === 'examples') {
        // Each example becomes a separate activity
        const content = block.content as ExamplesContent;
        questions += content.examples?.length || 1;
      } else if (['heading', 'paragraph', 'infobox'].includes(block.type)) {
        info++;
      }
    }
    
    return {
      totalItems: worksheet.blocks.length,
      convertibleItems: questions + info,
      questions,
      infoItems: info,
    };
  } else {
    const quiz = source as Quiz;
    let questions = 0;
    let info = 0;
    
    for (const slide of quiz.slides) {
      if (slide.type === 'activity') {
        questions++;
      } else if (slide.type === 'info') {
        info++;
      }
    }
    
    return {
      totalItems: quiz.slides.length,
      convertibleItems: questions + info,
      questions,
      infoItems: info,
    };
  }
}

