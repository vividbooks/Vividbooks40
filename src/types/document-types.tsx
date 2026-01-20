import { 
  FileEdit, 
  Book, 
  FlaskConical, 
  GraduationCap, 
  PlayCircle, 
  CheckSquare, 
  PenTool,
  FileText,
  Box,
  Gamepad2,
  LucideIcon
} from 'lucide-react';
import { LessonIcon } from '../components/icons/LessonIcon';
import { PracticeIcon } from '../components/icons/PracticeIcon';
import { TestIcon } from '../components/icons/TestIcon';
import { ExamIcon } from '../components/icons/ExamIcon';
import { TextbookIcon } from '../components/icons/TextbookIcon';
import { MethodologyIcon } from '../components/icons/MethodologyIcon';
import { WorkbookIcon } from '../components/icons/WorkbookIcon';
import { ExperimentIcon } from '../components/icons/ExperimentIcon';
import { ThreeModelIcon } from '../components/icons/ThreeModelIcon';
import { WorksheetIcon } from '../components/icons/WorksheetIcon';
import { ComponentType } from 'react';

export interface DocumentType {
  id: string;
  label: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 'lesson',
    label: 'Lekce',
    icon: LessonIcon,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  {
    id: 'worksheet',
    label: 'Pracovní listy',
    icon: WorksheetIcon,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200'
  },
  {
    id: 'textbook',
    label: 'Učebnice',
    icon: TextbookIcon,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  },
  {
    id: 'workbook',
    label: 'Pracovní sešit',
    icon: WorkbookIcon,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200'
  },
  {
    id: 'experiment',
    label: 'Experimenty a laborky',
    icon: ExperimentIcon,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  {
    id: 'methodology',
    label: 'Metodika',
    icon: MethodologyIcon,
    color: 'text-zinc-700',
    bgColor: 'bg-zinc-50',
    borderColor: 'border-zinc-200'
  },
  {
    id: 'practice',
    label: 'Procvičování',
    icon: PracticeIcon,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  {
    id: 'test',
    label: 'Test',
    icon: TestIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200'
  },
  {
    id: 'exam',
    label: 'Písemka',
    icon: ExamIcon,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  {
    id: 'guide',
    label: 'Návod',
    icon: FileText,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200'
  },
  {
    id: '3d-model',
    label: '3D model',
    icon: ThreeModelIcon,
    color: 'text-fuchsia-700',
    bgColor: 'bg-fuchsia-50',
    borderColor: 'border-fuchsia-200'
  },
  {
    id: 'minigame',
    label: 'Minihra',
    icon: Gamepad2,
    color: 'text-lime-700',
    bgColor: 'bg-lime-50',
    borderColor: 'border-lime-200'
  },
  {
    id: 'interactive',
    label: 'Interaktivní pracovní list',
    icon: PlayCircle,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200'
  },
  {
    id: 'bonus',
    label: 'Bonusy a přílohy',
    icon: FileText,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  {
    id: 'ucebni-text',
    label: 'Učební text',
    icon: Book,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200'
  }
];
