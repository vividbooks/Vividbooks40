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
  FillBlanksActivitySlide,
  ConnectPairsActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  VotingActivitySlide,
  BoardActivitySlide,
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
          
          case 'fill-blanks': {
            const fillSlide = activitySlide as FillBlanksActivitySlide;
            
            // Convert each sentence to a fill-blank block
            for (const sentence of fillSlide.sentences) {
              // Build segments from text and blanks
              const segments: any[] = [];
              let remainingText = sentence.text;
              
              // Sort blanks by their position in text (assuming they're marked as [blank_id])
              const sortedBlanks = [...sentence.blanks].sort((a, b) => {
                const posA = remainingText.indexOf(`[${a.id}]`);
                const posB = remainingText.indexOf(`[${b.id}]`);
                return posA - posB;
              });
              
              for (const blank of sortedBlanks) {
                const blankMarker = `[${blank.id}]`;
                const markerPos = remainingText.indexOf(blankMarker);
                
                if (markerPos > 0) {
                  // Add text before blank
                  segments.push({
                    type: 'text',
                    content: remainingText.substring(0, markerPos),
                  });
                }
                
                // Add blank - BlankItem uses 'text' for the correct answer
                segments.push({
                  type: 'blank',
                  id: blank.id,
                  correctAnswer: blank.text,
                  acceptedAnswers: [],
                });
                
                remainingText = remainingText.substring(markerPos + blankMarker.length);
              }
              
              // Add remaining text
              if (remainingText) {
                segments.push({
                  type: 'text',
                  content: remainingText,
                });
              }
              
              blocks.push({
                id: generateBlockId(),
                type: 'fill-blank',
                order: order++,
                width: 'full',
                content: {
                  instruction: fillSlide.instruction || 'Doplň chybějící slova',
                  segments: segments.length > 0 ? segments : [{ type: 'text', content: sentence.text }],
                },
              });
            }
            break;
          }
          
          case 'connect-pairs': {
            const pairsSlide = activitySlide as ConnectPairsActivitySlide;
            
            // Create native connect-pairs block
            blocks.push({
              id: generateBlockId(),
              type: 'connect-pairs',
              order: order++,
              width: 'full',
              content: {
                instruction: pairsSlide.instruction || 'Spoj správné dvojice',
                pairs: pairsSlide.pairs.map(pair => ({
                  id: pair.id,
                  left: {
                    id: pair.left.id,
                    type: pair.left.type,
                    content: pair.left.content,
                  },
                  right: {
                    id: pair.right.id,
                    type: pair.right.type,
                    content: pair.right.content,
                  },
                })),
                shuffleSides: pairsSlide.shuffleSides,
              },
            });
            break;
          }
          
          case 'image-hotspots': {
            const hotspotsSlide = activitySlide as ImageHotspotsActivitySlide;
            
            // Create native image-hotspots block
            blocks.push({
              id: generateBlockId(),
              type: 'image-hotspots',
              order: order++,
              width: 'full',
              content: {
                instruction: hotspotsSlide.instruction || 'Označ správná místa na obrázku',
                imageUrl: hotspotsSlide.imageUrl || '',
                hotspots: hotspotsSlide.hotspots.map(hotspot => ({
                  id: hotspot.id,
                  x: hotspot.x,
                  y: hotspot.y,
                  label: hotspot.label,
                  options: (hotspot as any).options || undefined,
                })),
                markerStyle: hotspotsSlide.markerStyle === 'pin' ? 'pin' 
                  : hotspotsSlide.markerStyle === 'question-mark' ? 'question-mark' 
                  : 'circle',
                markerSize: Math.round((hotspotsSlide.markerSize || 1) * 100),
                answerType: hotspotsSlide.answerType || 'text',
              },
            });
            break;
          }
          
          case 'video-quiz': {
            const videoSlide = activitySlide as VideoQuizActivitySlide;
            
            // Create native video-quiz block
            blocks.push({
              id: generateBlockId(),
              type: 'video-quiz',
              order: order++,
              width: 'full',
              content: {
                instruction: videoSlide.instruction || 'Video kvíz',
                videoUrl: videoSlide.videoUrl || '',
                videoId: videoSlide.videoId,
                questions: videoSlide.questions.map(q => ({
                  id: q.id,
                  timestamp: q.timestamp,
                  question: q.question,
                  options: q.options.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                    content: opt.content,
                    isCorrect: opt.isCorrect,
                  })),
                })),
              },
            });
            break;
          }
          
          case 'voting': {
            const votingSlide = activitySlide as VotingActivitySlide;
            
            // Convert voting to paragraph with options
            blocks.push({
              id: generateBlockId(),
              type: 'heading',
              order: order++,
              width: 'full',
              content: {
                text: votingSlide.question || 'Hlasování',
                level: 'h3' as const,
              },
            });
            
            if (votingSlide.options && votingSlide.options.length > 0) {
              const optionsHtml = votingSlide.options
                .map((opt, idx) => `<p>${String.fromCharCode(65 + idx)}) ${opt.content || opt.label || ''}</p>`)
                .join('');
              
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: optionsHtml,
                },
              });
            }
            break;
          }
          
          case 'board': {
            const boardSlide = activitySlide as BoardActivitySlide;
            
            // Convert board to instruction paragraph
            blocks.push({
              id: generateBlockId(),
              type: 'infobox',
              order: order++,
              width: 'full',
              content: {
                title: 'Nástěnka',
                html: `<p>${boardSlide.question || 'Sdílejte své odpovědi s třídou.'}</p>`,
                variant: 'yellow',
              },
            });
            break;
          }
        }
      }
      break;
    }
    
    case 'info': {
      const infoSlide = slide as InfoSlide;
      
      // First check if there's a layout with blocks (new format)
      if (infoSlide.layout && infoSlide.layout.blocks && infoSlide.layout.blocks.length > 0) {
        for (const block of infoSlide.layout.blocks) {
          // Text blocks become paragraphs or headings based on font size
          if (block.type === 'text' && block.content) {
            if (block.fontSize === 'xlarge' || block.fontWeight === 'bold') {
              blocks.push({
                id: generateBlockId(),
                type: 'heading',
                order: order++,
                width: 'full',
                content: {
                  text: block.content,
                  level: 'h2' as const,
                },
              });
            } else {
              blocks.push({
                id: generateBlockId(),
                type: 'paragraph',
                order: order++,
                width: 'full',
                content: {
                  html: `<p>${block.content}</p>`,
                },
              });
            }
          }
          // Image blocks
          else if (block.type === 'image' && block.content) {
            blocks.push({
              id: generateBlockId(),
              type: 'image',
              order: order++,
              width: 'full',
              content: {
                url: block.content,
                alt: block.imageCaption || '',
                caption: block.imageCaption || '',
                size: 'medium',
                alignment: 'center',
              },
            });
          }
        }
      } else {
        // Legacy format - use title and content fields
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
      }
      
      // Add media if present
      if (infoSlide.media && infoSlide.media.url) {
        blocks.push({
          id: generateBlockId(),
          type: 'image',
          order: order++,
          width: 'full',
          content: {
            url: infoSlide.media.url,
            alt: infoSlide.media.caption || '',
            caption: infoSlide.media.caption || '',
            size: 'medium',
            alignment: 'center',
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

