import { 
  BookOpen, 
  Layers, 
  Users, 
  Monitor, 
  Printer, 
  ShoppingBag,
  Globe,
  Folder,
  BarChart3,
  User,
  LayoutDashboard,
  Gamepad2,
  Zap,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { AvatarDisplay } from './student/SimpleAvatarCreator';

interface ToolsMenuProps {
  onItemClick?: () => void;
  onClose?: () => void;
  activeItem?: 'library' | 'my-content' | 'my-classes' | 'profile' | 'student-wall' | 'practice' | 'messages';
  isStudentMode?: boolean;
}

export const ToolsMenu = ({ onItemClick, onClose, activeItem = 'library', isStudentMode = false }: ToolsMenuProps) => {
  const navigate = useNavigate();
  const { student } = useStudentAuth();

  const handleLibraryClick = () => {
    if (activeItem !== 'library') {
      navigate('/docs');
    }
    if (onItemClick) onItemClick();
  };

  const handleMyContentClick = () => {
    if (activeItem !== 'my-content') {
      navigate('/library/my-content');
    }
    if (onItemClick) onItemClick();
  };

  const handleMyClassesClick = () => {
    if (activeItem !== 'my-classes') {
      navigate('/library/my-classes');
    }
    if (onItemClick) onItemClick();
  };

  const handleStudentWallClick = () => {
    if (activeItem !== 'student-wall') {
      navigate('/library/student-wall');
    }
    if (onItemClick) onItemClick();
  };

  const handlePracticeClick = () => {
    if (activeItem !== 'practice') {
      navigate('/library/practice');
    }
    if (onItemClick) onItemClick();
  };

  const handleStudentContentClick = () => {
    navigate('/student/workspace');
    if (onItemClick) onItemClick();
  };

  const handleClassChatClick = () => {
    navigate('/class-chat');
    if (onItemClick) onItemClick();
  };

  return (
    <div className="flex flex-col p-4 animate-in slide-in-from-left-2 duration-300 pb-20 overflow-y-auto h-full">
      
      {/* For Students: Custom order - Knihovna, Úkoly, Zprávy, Můj účet */}
      {isStudentMode ? (
        <>
          {/* 1. Knihovna - Student */}
          <button
            onClick={handleLibraryClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border shadow-sm mb-4 group transition-all h-[88px] ${
              activeItem === 'library' ? 'border-white/30' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 ml-1">
              <svg viewBox="0 0 110 54" className="w-[53px] h-[53px]" fill="white" preserveAspectRatio="xMidYMid meet">
                <g id="VIVID">
                  <path d="M21.6759 23.3386L12.3448 0H15.6268L23.4845 19.6339H23.6316L31.2665 0H34.5118L25.1439 23.3386H21.6759Z" />
                  <path d="M40.4137 0V23.3386H37.2053V0H40.4137Z" />
                  <path d="M52.4405 23.3386L43.1072 0H46.3892L54.247 19.6339H54.3941L62.029 0H65.2742L55.9064 23.3386H52.4405Z" />
                  <path d="M71.1783 0V23.3386H67.9699V0H71.1783Z" />
                  <path d="M75.6784 0H84.0878C91.3917 0 96.0021 4.37178 96.0021 11.6704C96.0021 18.969 91.3917 23.3408 84.0878 23.3408H75.6784V0ZM83.9039 20.7073C89.5852 20.7073 92.6833 17.3372 92.6833 11.6682C92.6833 5.99925 89.5852 2.62915 83.9039 2.62915H78.8868V20.7073H83.9039Z" />
                </g>
                <g id="BOOKS">
                  <path d="M9.88492 52.9764H0V29.6377H9.48035C15.2352 29.6377 17.5955 32.1561 17.5955 35.8608C17.5955 38.566 15.6765 40.4173 13.2059 40.8627C16.0465 41.3451 18.2597 43.2333 18.2597 46.5686C18.2576 50.6036 15.3066 52.9764 9.88492 52.9764ZM3.0981 39.7133H9.59069C12.9462 39.7133 14.3849 38.2683 14.3849 36.0085C14.3849 33.7857 12.9462 32.2669 9.59069 32.2669H3.0981V39.7133ZM3.0981 42.1947V50.345H9.81136C13.2794 50.345 15.0859 48.8262 15.0859 46.3079C15.0859 43.7526 13.2794 42.1968 9.81136 42.1968H3.0981V42.1947Z" />
                  <path d="M87.4736 52.9764L77.8829 41.8991L75.1894 44.6413V52.9764H71.981V29.6377H75.1894V41.1582L86.4395 29.6377H90.2386L80.2433 39.9001L91.3463 52.9764H87.4736Z" />
                  <path d="M94.1869 44.4544C94.3708 48.7154 97.285 50.9013 101.194 50.9013C104.662 50.9013 106.837 49.4194 106.837 46.8641C106.837 44.7152 105.435 43.6787 102.41 43.0855L97.7999 42.1968C94.3686 41.5298 92.0083 39.6785 92.0083 36.0477C92.0083 31.9736 95.2167 29.1945 100.307 29.1945C106.136 29.1945 109.491 32.306 109.528 37.5665L106.614 37.7142C106.504 33.8618 104.18 31.6759 100.344 31.6759C96.9886 31.6759 95.1064 33.2686 95.1064 35.863C95.1064 38.1597 96.6186 38.9006 99.3122 39.4199L103.518 40.2347C107.761 41.0496 109.9 42.903 109.9 46.6447C109.9 50.9426 106.211 53.424 101.194 53.424C95.4763 53.424 91.3095 50.2755 91.3095 44.6435L94.1869 44.4544Z" />
                  <g transform="translate(19.43, 29.2)">
                    <path d="M38.4017 3.11805C43.4642 3.11805 47.5813 7.25299 47.5813 12.3375C47.5813 17.4219 43.4642 21.5569 38.4017 21.5569C33.3392 21.5569 29.2221 17.4219 29.2221 12.3375C29.2221 7.25299 33.3392 3.11805 38.4017 3.11805ZM38.4017 2.6226e-06C31.617 2.6226e-06 26.1175 5.5234 26.1175 12.3375C26.1175 19.1515 31.617 24.6749 38.4017 24.6749C45.1863 24.6749 50.6859 19.1515 50.6859 12.3375C50.6859 5.5234 45.1863 2.6226e-06 38.4017 2.6226e-06Z" />
                    <path d="M12.2842 3.16585C17.3186 3.16585 21.4162 7.27906 21.4162 12.3375C21.4162 17.3937 17.3208 21.5091 12.2842 21.5091C7.24764 21.5091 3.15218 17.3959 3.15218 12.3375C3.15435 7.28124 7.24981 3.16585 12.2842 3.16585ZM12.2842 0C5.49955 0 0 5.5234 0 12.3375C0 19.1515 5.49955 24.6749 12.2842 24.6749C19.0689 24.6749 24.5684 19.1515 24.5684 12.3375C24.5706 5.5234 19.0689 0 12.2842 0Z" />
                  </g>
                </g>
              </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full">
              <span className="text-[18px] font-bold leading-tight text-white" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Knihovna
              </span>
              <span className="text-[13px] text-white/70 font-medium max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                digitální učebnice
              </span>
            </div>
          </button>

          {/* 2. Úkoly - Student */}
          <button
            onClick={handleStudentContentClick}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(250,204,21,0.15)] transition-all duration-300 group text-left mb-4 relative overflow-hidden h-[88px] border-white/10"
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
              <FileText className="w-8 h-8 text-white group-hover:text-yellow-400 transition-colors" />
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className="text-[18px] font-bold text-white group-hover:text-yellow-400 transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Úkoly
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                vlastní dokumenty a práce
              </span>
            </div>
          </button>

          {/* 3. Zprávy - Student */}
          <button
            onClick={handleClassChatClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-sky-400 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)] transition-all duration-300 group text-left mb-4 relative overflow-hidden h-[88px] ${
              activeItem === 'messages' ? 'border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.15)]' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className={`transition-colors ${activeItem === 'messages' ? 'text-sky-400' : 'text-white group-hover:text-sky-400'}`} />
              </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className={`text-[18px] font-bold transition-colors ${activeItem === 'messages' ? 'text-sky-400' : 'text-white group-hover:text-sky-400'}`} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Zprávy
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                třídní chat a spolužáci
              </span>
            </div>
          </button>

          {/* 4. Můj účet - Student */}
          <button
            onClick={handleStudentWallClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-white hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all duration-300 group text-left mb-4 relative overflow-hidden h-[88px] ${
              activeItem === 'student-wall' ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.15)]' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
              {student?.avatar ? (
                <AvatarDisplay avatar={student.avatar} size={40} />
              ) : (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    backgroundColor: student?.color || '#6366f1',
                  }}
                >
                  {student?.initials || '?'}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className="text-[18px] font-bold text-white transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Můj účet
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                úkoly, výsledky a hodnocení
              </span>
            </div>
          </button>

        </>
      ) : (
        <>
          {/* Teacher: Knihovna first */}
          <button
            onClick={handleLibraryClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border shadow-sm mb-6 group transition-all h-[88px] ${
              activeItem === 'library' ? 'border-white/30' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 ml-1">
              <svg viewBox="0 0 110 54" className="w-[53px] h-[53px]" fill="white" preserveAspectRatio="xMidYMid meet">
                <g id="VIVID">
                  <path d="M21.6759 23.3386L12.3448 0H15.6268L23.4845 19.6339H23.6316L31.2665 0H34.5118L25.1439 23.3386H21.6759Z" />
                  <path d="M40.4137 0V23.3386H37.2053V0H40.4137Z" />
                  <path d="M52.4405 23.3386L43.1072 0H46.3892L54.247 19.6339H54.3941L62.029 0H65.2742L55.9064 23.3386H52.4405Z" />
                  <path d="M71.1783 0V23.3386H67.9699V0H71.1783Z" />
                  <path d="M75.6784 0H84.0878C91.3917 0 96.0021 4.37178 96.0021 11.6704C96.0021 18.969 91.3917 23.3408 84.0878 23.3408H75.6784V0ZM83.9039 20.7073C89.5852 20.7073 92.6833 17.3372 92.6833 11.6682C92.6833 5.99925 89.5852 2.62915 83.9039 2.62915H78.8868V20.7073H83.9039Z" />
                </g>
                <g id="BOOKS">
                  <path d="M9.88492 52.9764H0V29.6377H9.48035C15.2352 29.6377 17.5955 32.1561 17.5955 35.8608C17.5955 38.566 15.6765 40.4173 13.2059 40.8627C16.0465 41.3451 18.2597 43.2333 18.2597 46.5686C18.2576 50.6036 15.3066 52.9764 9.88492 52.9764ZM3.0981 39.7133H9.59069C12.9462 39.7133 14.3849 38.2683 14.3849 36.0085C14.3849 33.7857 12.9462 32.2669 9.59069 32.2669H3.0981V39.7133ZM3.0981 42.1947V50.345H9.81136C13.2794 50.345 15.0859 48.8262 15.0859 46.3079C15.0859 43.7526 13.2794 42.1968 9.81136 42.1968H3.0981V42.1947Z" />
                  <path d="M87.4736 52.9764L77.8829 41.8991L75.1894 44.6413V52.9764H71.981V29.6377H75.1894V41.1582L86.4395 29.6377H90.2386L80.2433 39.9001L91.3463 52.9764H87.4736Z" />
                  <path d="M94.1869 44.4544C94.3708 48.7154 97.285 50.9013 101.194 50.9013C104.662 50.9013 106.837 49.4194 106.837 46.8641C106.837 44.7152 105.435 43.6787 102.41 43.0855L97.7999 42.1968C94.3686 41.5298 92.0083 39.6785 92.0083 36.0477C92.0083 31.9736 95.2167 29.1945 100.307 29.1945C106.136 29.1945 109.491 32.306 109.528 37.5665L106.614 37.7142C106.504 33.8618 104.18 31.6759 100.344 31.6759C96.9886 31.6759 95.1064 33.2686 95.1064 35.863C95.1064 38.1597 96.6186 38.9006 99.3122 39.4199L103.518 40.2347C107.761 41.0496 109.9 42.903 109.9 46.6447C109.9 50.9426 106.211 53.424 101.194 53.424C95.4763 53.424 91.3095 50.2755 91.3095 44.6435L94.1869 44.4544Z" />
                  <g transform="translate(19.43, 29.2)">
                    <path d="M38.4017 3.11805C43.4642 3.11805 47.5813 7.25299 47.5813 12.3375C47.5813 17.4219 43.4642 21.5569 38.4017 21.5569C33.3392 21.5569 29.2221 17.4219 29.2221 12.3375C29.2221 7.25299 33.3392 3.11805 38.4017 3.11805ZM38.4017 2.6226e-06C31.617 2.6226e-06 26.1175 5.5234 26.1175 12.3375C26.1175 19.1515 31.617 24.6749 38.4017 24.6749C45.1863 24.6749 50.6859 19.1515 50.6859 12.3375C50.6859 5.5234 45.1863 2.6226e-06 38.4017 2.6226e-06Z" />
                    <path d="M12.2842 3.16585C17.3186 3.16585 21.4162 7.27906 21.4162 12.3375C21.4162 17.3937 17.3208 21.5091 12.2842 21.5091C7.24764 21.5091 3.15218 17.3959 3.15218 12.3375C3.15435 7.28124 7.24981 3.16585 12.2842 3.16585ZM12.2842 0C5.49955 0 0 5.5234 0 12.3375C0 19.1515 5.49955 24.6749 12.2842 24.6749C19.0689 24.6749 24.5684 19.1515 24.5684 12.3375C24.5706 5.5234 19.0689 0 12.2842 0Z" />
                  </g>
                </g>
              </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full">
              <span className="text-[18px] font-bold leading-tight text-white" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Knihovna
              </span>
              <span className="text-[13px] text-white/70 font-medium max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                digitální učebnice
              </span>
            </div>
          </button>

          {/* 2. Můj obsah (Yellow Style) - Teacher only */}
          <button
            onClick={handleMyContentClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(250,204,21,0.15)] transition-all duration-300 group text-left mb-6 relative overflow-hidden h-[88px] ${
              activeItem === 'my-content' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.15)]' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
               <svg viewBox="0 0 42 34" className="w-8 h-8" fill="none" preserveAspectRatio="xMidYMid meet">
                  <g clipPath="url(#clip0_folder)">
                    <path d="M35.5363 33.6349H1.05618L7.63819 14.4323C8.63455 11.5338 11.3821 9.57131 14.4315 9.57131H35.0834C36.9855 9.57131 38.7367 10.4469 39.884 12.0169C41.0011 13.5568 41.3333 15.4891 40.7294 17.3308L35.5061 33.6651L35.5363 33.6349ZM5.28315 30.6156H33.302L37.8611 16.3949C38.1328 15.4891 37.9819 14.5531 37.4384 13.7983C36.8949 13.0435 36.0193 12.5906 35.0834 12.5906H14.4315C12.6502 12.5906 11.05 13.7379 10.4763 15.3985L5.25296 30.6156H5.28315Z" fill="#FFDD00" />
                    <path d="M3.01927 32.1255C3.01927 32.9709 2.35503 33.6351 1.50964 33.6351C0.66424 33.6351 0 32.9709 0 32.1255V4.58973C0 2.05354 2.0531 0.000439041 4.58929 0.000439041H9.75225C10.96 0.000439041 12.1375 0.483522 13.0131 1.35911L14.9454 3.29144C15.3681 3.71414 15.9418 3.95568 16.5456 3.95568H31.9137C34.4197 3.95568 36.4728 6.00879 36.4728 8.51478V9.84326C36.4728 10.6887 35.8086 11.3529 34.9632 11.3529C34.1178 11.3529 33.4535 10.6887 33.4535 9.84326L32.9402 10.749C32.9402 9.90365 31.7627 10.3565 30.8871 10.3565L17.3004 10.9C15.9116 10.9 17.3004 10.9 16.3041 9.90365L14.3415 10.5981C14.0396 10.2962 12.8621 11.9568 12.4394 11.9568L8.72569 15.8818" fill="#FFDD00" />
                  </g>
                  <defs>
                    <clipPath id="clip0_folder">
                      <rect fill="white" height="33.6347" width="41.0319" />
                    </clipPath>
                  </defs>
               </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className="text-[18px] font-bold text-white group-hover:text-yellow-400 transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                 Můj obsah
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                vlastní interaktivní materiály
              </span>
            </div>
          </button>

          {/* 3. Moje třída (Green Style) - Teacher only */}
          <button
            onClick={handleMyClassesClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-[#2DD4BF] hover:shadow-[0_0_15px_rgba(45,212,191,0.15)] transition-all duration-300 group text-left mb-4 relative overflow-hidden h-[88px] ${
              activeItem === 'my-classes' ? 'border-[#2DD4BF] shadow-[0_0_15px_rgba(45,212,191,0.15)]' : 'border-white/10'
            }`}
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
               <svg viewBox="0 0 29 27" className="w-8 h-8" fill="none" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="20.4" width="8.09" height="6.376" rx="2.158" fill="#32f4ab" />
                  <rect x="20.8" y="0" width="8.09" height="26.779" rx="2.158" fill="#32f4ab" />
                  <rect x="10.4" y="11.48" width="8.09" height="15.302" rx="2.158" fill="#32f4ab" />
               </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className="text-[18px] font-bold text-white group-hover:text-[#2DD4BF] transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                 Moje třídy
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                zadávání úkolů a výsledky
              </span>
            </div>
          </button>

          {/* 4. Zprávy (Blue Style) - Teacher only */}
          <button
            onClick={handleClassChatClick}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border hover:border-blue-400 hover:shadow-[0_0_15px_rgba(96,165,250,0.15)] transition-all duration-300 group text-left mb-2 relative overflow-hidden h-[88px] border-white/10"
          >
            <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" className="text-white group-hover:text-blue-400 transition-colors" />
              </svg>
            </div>
            <div className="flex flex-col items-start justify-center h-full z-10">
              <span className="text-[18px] font-bold text-white group-hover:text-blue-400 transition-colors" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                Zprávy
              </span>
              <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                třídní chaty se studenty
              </span>
            </div>
          </button>
          
          {/* 5. Můj účet - Teacher */}
          <div className="mt-auto pt-4 border-t border-white/10">
            <button
              onClick={() => {
                navigate('/library/profile');
                if (onItemClick) onItemClick();
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#5d667c] hover:bg-[#4a5162] border transition-all duration-300 group text-left mb-2 relative overflow-hidden h-[88px] ${
                activeItem === 'profile' ? 'border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'border-white/10'
              }`}
            >
              <div className="shrink-0 z-10 group-hover:scale-110 transition-transform duration-300 ml-1 w-[53px] flex justify-center">
                <User className={`w-8 h-8 transition-colors ${activeItem === 'profile' ? 'text-indigo-400' : 'text-white group-hover:text-indigo-400'}`} />
              </div>
              <div className="flex flex-col items-start justify-center h-full z-10">
                <span className={`text-[18px] font-bold transition-colors ${activeItem === 'profile' ? 'text-indigo-400' : 'text-white group-hover:text-indigo-400'}`} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                  Můj účet
                </span>
                <span className="text-[13px] text-white/70 font-medium group-hover:text-white/90 max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 overflow-hidden leading-tight">
                  nastavení účtu a licencí
                </span>
              </div>
            </button>
          </div>
        </>
      )}

    </div>
  );
};