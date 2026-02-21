/**
 * Quiz Join Page
 * 
 * Robust student session management:
 * - Persistent student identity across sessions
 * - Auto-reconnect on page reload/return
 * - Works across devices (wifi/data)
 * - Results tied to student name
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { ref, onValue, off, set, update, get } from 'firebase/database';
import { database } from '../../utils/firebase-config';
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Pause,
  ChevronRight,
  Send,
  Users,
  ArrowLeft,
  ArrowRight,
  WifiOff,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import MathKeyboard, { MathDisplay } from '../math/MathKeyboard';
import { MathText } from '../math/MathText';
import { ExampleActivityView } from './ExampleActivityView';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  SlideResponse,
  LiveQuizSession,
  InfoSlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  ToolsSlide,
  TreasureType,
} from '../../types/quiz';
import { BlockLayoutView } from './QuizPreview';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import { FormView } from './slides/FormView';
import { CertificateView } from './slides/CertificateView';
import { useBoardPosts } from '../../hooks/useBoardPosts';
import { useVoting } from '../../hooks/useVoting';
import { checkMathAnswer } from '../../utils/math-compare';
import Lottie from 'lottie-react';

// Competition assets (Supabase storage — competition_files bucket)
const COMP_SB = 'https://njbtqmsxbyvpwigfceke.supabase.co/storage/v1/object/public/competition_files';
const COMP_ASSETS = {
  countdown: `${COMP_SB}/animace/321.json`,
  celebrate: `${COMP_SB}/animace/celebrate.json`,
  rank: (n: number) => `${COMP_SB}/animace/rank_${n}.json`,
  drum: `${COMP_SB}/Drum.json`,
};

const SAD_LOTTIE_DATA = {"v":"5.10.2","fr":60,"ip":0,"op":210,"w":300,"h":300,"nm":"34","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Vrstva 13","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.223],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":10,"s":[22.715]},{"t":49,"s":[-40.285]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.615,"y":0.792},"o":{"x":0.452,"y":0},"t":10,"s":[-14.779,-22.712,0],"to":[0,0,0],"ti":[-3.076,-13.797,0]},{"i":{"x":0.465,"y":1},"o":{"x":0.333,"y":0.322},"t":24.793,"s":[-16.027,4.203,0],"to":[1.637,7.341,0],"ti":[-7.592,-5.851,0]},{"t":49,"s":[-3.067,24.928,0]}],"ix":2,"l":2},"a":{"a":0,"k":[244.315,-148.49,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":10,"s":[0,0,100]},{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":19,"s":[-70.033,69.967,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":32,"s":[-70.033,69.967,100]},{"t":49,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[242.433,-148.714],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[244.315,-148.49],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":10,"op":49,"st":20,"ct":1,"bm":0},{"ddd":0,"ind":2,"ty":4,"nm":"Vrstva 10","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.223],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":42,"s":[22.715]},{"t":81,"s":[-40.285]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.615,"y":0.792},"o":{"x":0.452,"y":0},"t":42,"s":[-14.779,-22.712,0],"to":[0,0,0],"ti":[-3.076,-13.797,0]},{"i":{"x":0.465,"y":1},"o":{"x":0.333,"y":0.322},"t":56.793,"s":[-16.027,4.203,0],"to":[1.637,7.341,0],"ti":[-7.592,-5.851,0]},{"t":81,"s":[-3.067,24.928,0]}],"ix":2,"l":2},"a":{"a":0,"k":[244.315,-148.49,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":42,"s":[0,0,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":56.793,"s":[-70.033,69.967,100]},{"t":81,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[242.433,-148.714],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[244.315,-148.49],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":42,"op":81,"st":52,"ct":1,"bm":0},{"ddd":0,"ind":3,"ty":4,"nm":"Vrstva 9","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.223],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":31,"s":[-35]},{"t":69,"s":[28]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.588,"y":0.744},"o":{"x":0.362,"y":0},"t":31,"s":[11.552,-18.356,0],"to":[0,0,0],"ti":[0.448,-11.898,0]},{"i":{"x":0.592,"y":1},"o":{"x":0.284,"y":0.201},"t":48.035,"s":[17.261,2.256,0],"to":[-0.244,6.483,0],"ti":[6.23,-7.479,0]},{"t":69,"s":[8.581,23.644,0]}],"ix":2,"l":2},"a":{"a":0,"k":[244.315,-148.49,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":31,"s":[0,0,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":45.414,"s":[70,70,100]},{"t":69,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[242.433,-148.714],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[244.315,-148.49],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":31,"op":69,"st":40,"ct":1,"bm":0},{"ddd":0,"ind":4,"ty":4,"nm":"Vrstva 11","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.223],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":75,"s":[-35]},{"t":114,"s":[28]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.663,"y":0.783},"o":{"x":0.44,"y":0},"t":75,"s":[14.618,-21.751,0],"to":[0,0,0],"ti":[-0.073,-12.997,0]},{"i":{"x":0.475,"y":1},"o":{"x":0.204,"y":0.221},"t":90,"s":[22.055,1.434,0],"to":[0.038,6.81,0],"ti":[6.074,-7.29,0]},{"t":114,"s":[14.056,23.115,0]}],"ix":2,"l":2},"a":{"a":0,"k":[244.315,-148.49,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":75,"s":[0,0,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":89.793,"s":[70,70,100]},{"t":114,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[242.433,-148.714],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[244.315,-148.49],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":75,"op":114,"st":75,"ct":1,"bm":0},{"ddd":0,"ind":5,"ty":4,"nm":"Vrstva 8","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.223],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":7,"s":[-35]},{"t":44,"s":[28]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.344,"y":1},"o":{"x":0.333,"y":0},"t":7,"s":[17.027,-18.886,0],"to":[0,0,0],"ti":[17.666,-21.205,0]},{"t":44,"s":[14.056,23.115,0]}],"ix":2,"l":2},"a":{"a":0,"k":[244.315,-148.49,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.331,0.331,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":7,"s":[0,0,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.54,0.54,0.333],"y":[0,0,0]},"t":21.035,"s":[70,70,100]},{"t":44,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[242.433,-148.714],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[244.315,-148.49],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":7,"op":44,"st":15,"ct":1,"bm":0},{"ddd":0,"ind":6,"ty":4,"nm":"Vrstva 12","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":126,"s":[22]},{"t":167,"s":[-4]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":126,"s":[-15.447,-20.191,0],"to":[0,0,0],"ti":[-2.103,-18.521,0]},{"t":167,"s":[-17.91,12.417,0]}],"ix":2,"l":2},"a":{"a":0,"k":[219.761,-164.065,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":126,"s":[0,0,100]},{"t":167,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[217.879,-164.289],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[219.761,-164.065],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":126,"op":210,"st":140,"ct":1,"bm":0},{"ddd":0,"ind":7,"ty":4,"nm":"Vrstva 7","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":0,"s":[-4]},{"t":27,"s":[-39]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[-17.91,12.417,0],"to":[-2.626,6.299,0],"ti":[0,0,0]},{"t":27,"s":[-13.745,23.251,0]}],"ix":2,"l":2},"a":{"a":0,"k":[219.761,-164.065,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0,"s":[100,100,100]},{"t":27,"s":[0,0,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-1.14,-2.687]],"o":[[0,0],[0,0]],"v":[[1.801,-4.825],[-1.619,4.825]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[1,1,1,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":2.092,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[217.879,-164.289],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":80,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":3,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false},{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,-2.989],[2.989,0],[0,2.989],[-0.115,0]],"o":[[0,2.989],[-2.989,0],[0,-2.989],[0.461,0]],"v":[[5.412,3.34],[0,8.752],[-5.412,3.34],[0,-8.752]],"c":true},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"fl","c":{"a":0,"k":[0.349019616842,0.635294139385,1,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[219.761,-164.065],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 2","np":2,"cix":2,"bm":0,"ix":2,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":27,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":8,"ty":4,"nm":"Vrstva 6","parent":13,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.167],"y":[0]},"t":0,"s":[-2]},{"i":{"x":[0.813],"y":[1]},"o":{"x":[0.823],"y":[0]},"t":28,"s":[0]},{"i":{"x":[0.833],"y":[0.951]},"o":{"x":[0.333],"y":[0]},"t":60,"s":[8]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.167],"y":[-0.068]},"t":73,"s":[-8]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":82,"s":[0]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":91,"s":[-4]},{"i":{"x":[0.833],"y":[2.5]},"o":{"x":[0.333],"y":[0]},"t":116,"s":[-1]},{"i":{"x":[0.833],"y":[1]},"o":{"x":[0.167],"y":[2.75]},"t":134,"s":[-1]},{"t":167,"s":[-2]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.156,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[0.301,14.965,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.813,"y":1},"o":{"x":0.823,"y":0},"t":28,"s":[-0.847,-0.705,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.714,"y":0.28},"o":{"x":0.422,"y":0},"t":60,"s":[1.928,21.022,0],"to":[0,0,0],"ti":[0.491,2.833,0]},{"i":{"x":0.622,"y":0.722},"o":{"x":0.314,"y":0.464},"t":72.475,"s":[5.013,14.7,0],"to":[-0.491,-2.833,0],"ti":[3.022,-1.044,0]},{"i":{"x":0.619,"y":0.631},"o":{"x":0.295,"y":0.382},"t":82,"s":[-3.148,12.3,0],"to":[2.146,2.216,0],"ti":[0,0,0]},{"i":{"x":0.626,"y":0.655},"o":{"x":0.297,"y":0.295},"t":94,"s":[2.984,14.84,0],"to":[0,0,0],"ti":[3.615,0.61,0]},{"i":{"x":0.656,"y":0.484},"o":{"x":0.329,"y":0.363},"t":105,"s":[-1.204,18.178,0],"to":[3.264,0.289,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":0.686},"o":{"x":0.312,"y":0.555},"t":118.041,"s":[3.316,14.934,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":0.671},"o":{"x":0.333,"y":0.278},"t":134,"s":[-2.855,14.655,0],"to":[0,0,0],"ti":[-1.396,1.567,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0.561},"t":151,"s":[4.363,14.489,0],"to":[-1.969,-0.077,0],"ti":[0,0,0]},{"t":167,"s":[0.301,14.965,0]}],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":1,"k":[{"i":{"x":0.156,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[{"i":[[0,0],[4.91,-4.579]],"o":[[0,0],[0,0]],"v":[[5.805,1.21],[-4.497,1.828]],"c":false}]},{"i":{"x":0.813,"y":1},"o":{"x":0.823,"y":0},"t":28,"s":[{"i":[[0,0],[5.219,-2.658]],"o":[[0,0],[0,0]],"v":[[4.611,0.143],[-4.611,0.667]],"c":false}]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":60,"s":[{"i":[[0,0],[2.654,-2.475]],"o":[[0,0],[0,0]],"v":[[3.074,-0.832],[-2.495,-0.498]],"c":false}]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":82,"s":[{"i":[[0,0],[2.654,-2.475]],"o":[[0,0],[0,0]],"v":[[3.074,-0.832],[-2.495,-0.498]],"c":false}]},{"t":116,"s":[{"i":[[0,0],[4.91,-4.579]],"o":[[0,0],[0,0]],"v":[[5.805,1.21],[-4.497,1.828]],"c":false}]}],"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[0.274509817362,0.290196090937,0.870588243008,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":1,"k":[{"i":{"x":[0.156],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":0,"s":[4]},{"i":{"x":[0.813],"y":[1]},"o":{"x":[0.823],"y":[0]},"t":28,"s":[11]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":60,"s":[5]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":82,"s":[5]},{"t":116,"s":[4]}],"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":9,"ty":4,"nm":"Vrstva 5","parent":8,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[11.981,-23.362,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":0.667},"o":{"x":0.333,"y":0.333},"t":29,"s":[12.308,-19.626,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":82,"s":[12.308,-19.626,0],"to":[0,0,0],"ti":[0,0,0]},{"t":105,"s":[11.981,-23.362,0]}],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[-5.76,-1.063]],"o":[[0,0],[0,0]],"v":[[-3.82,-2.596],[3.82,2.596]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[0.274509817362,0.290196090937,0.870588243008,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":3.138,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":10,"ty":4,"nm":"Vrstva 4","parent":8,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[-13.689,-20.98,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":0.667},"o":{"x":0.333,"y":0.333},"t":29,"s":[-13.363,-17.244,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":82,"s":[-13.363,-17.244,0],"to":[0,0,0],"ti":[0,0,0]},{"t":105,"s":[-13.689,-20.98,0]}],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":0,"k":[100,100,100],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"ind":0,"ty":"sh","ix":1,"ks":{"a":0,"k":{"i":[[0,0],[5.76,-1.063]],"o":[[0,0],[0,0]],"v":[[3.82,-2.596],[-3.82,2.596]],"c":false},"ix":2},"nm":"Path 1","mn":"ADBE Vector Shape - Group","hd":false},{"ty":"st","c":{"a":0,"k":[0.274509817362,0.290196090937,0.870588243008,1],"ix":3},"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":3.138,"ix":5},"lc":2,"lj":1,"ml":10,"bm":0,"nm":"Stroke 1","mn":"ADBE Vector Graphic - Stroke","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":11,"ty":4,"nm":"Vrstva 3","parent":8,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[6.636,-13.293,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":3,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":10,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":17,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":69,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":75,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":82,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":108,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":114,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":117,"s":[100,40,100]},{"t":123,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[8.859,8.859],"ix":2},"p":{"a":0,"k":[0,0],"ix":3},"nm":"Ellipse Path 1","mn":"ADBE Vector Shape - Ellipse","hd":false},{"ty":"fl","c":{"a":0,"k":[0.274509817362,0.290196090937,0.870588243008,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":12,"ty":4,"nm":"Vrstva 2","parent":8,"sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":0,"k":0,"ix":10},"p":{"a":0,"k":[-8.385,-11.503,0],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":3,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":10,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":17,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":69,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":75,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":82,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":108,"s":[100,100,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":114,"s":[100,40,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":117,"s":[100,40,100]},{"t":123,"s":[100,100,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[8.859,8.859],"ix":2},"p":{"a":0,"k":[0,0],"ix":3},"nm":"Ellipse Path 1","mn":"ADBE Vector Shape - Ellipse","hd":false},{"ty":"fl","c":{"a":0,"k":[0.274509817362,0.290196090937,0.870588243008,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0},{"ddd":0,"ind":13,"ty":4,"nm":"Vrstva 1","sr":1,"ks":{"o":{"a":0,"k":100,"ix":11},"r":{"a":1,"k":[{"i":{"x":[0.111],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":0,"s":[5]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":19,"s":[-3]},{"i":{"x":[0.667],"y":[1]},"o":{"x":[0.333],"y":[0]},"t":37,"s":[5]},{"t":53,"s":[5]}],"ix":10},"p":{"a":1,"k":[{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":0,"s":[150,150,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.29,"y":1},"o":{"x":0.333,"y":0},"t":18.441,"s":[149.75,136.75,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.688,"y":0},"t":28,"s":[149.75,135.25,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":53,"s":[150,173,0],"to":[0,0,0],"ti":[1.279,6.218,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":69,"s":[149.902,145.152,0],"to":[-0.221,-1.074,0],"ti":[0.387,-0.037,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":78,"s":[146,145.5,0],"to":[-2.625,0.25,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":91,"s":[154,153.5,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":105,"s":[146,153.5,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":117,"s":[152,150,0],"to":[0,0,0],"ti":[0,0,0]},{"i":{"x":0.667,"y":1},"o":{"x":0.333,"y":0},"t":134,"s":[148.5,145.5,0],"to":[0,0,0],"ti":[2.125,-2.625,0]},{"t":167,"s":[150,150,0]}],"ix":2,"l":2},"a":{"a":0,"k":[0,0,0],"ix":1,"l":2},"s":{"a":1,"k":[{"i":{"x":[0.111,0.111,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":0,"s":[300,300,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":19,"s":[282,315,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":53,"s":[309,294,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":72,"s":[300,300,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":78,"s":[287,307,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":91,"s":[300,300,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":105,"s":[300,288,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":117,"s":[300,300,100]},{"i":{"x":[0.667,0.667,0.667],"y":[1,1,1]},"o":{"x":[0.333,0.333,0.333],"y":[0,0,0]},"t":134,"s":[290,309,100]},{"t":167,"s":[300,300,100]}],"ix":6,"l":2}},"ao":0,"shapes":[{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[53.673,53.673],"ix":2},"p":{"a":0,"k":[0,0],"ix":3},"nm":"Ellipse Path 1","mn":"ADBE Vector Shape - Ellipse","hd":false},{"ty":"fl","c":{"a":0,"k":[1,0.866666674614,0,1],"ix":4},"o":{"a":0,"k":100,"ix":5},"r":1,"bm":0,"nm":"Fill 1","mn":"ADBE Vector Graphic - Fill","hd":false},{"ty":"tr","p":{"a":0,"k":[0,0],"ix":2},"a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"r":{"a":0,"k":0,"ix":6},"o":{"a":0,"k":100,"ix":7},"sk":{"a":0,"k":0,"ix":4},"sa":{"a":0,"k":0,"ix":5},"nm":"Transform"}],"nm":"Group 1","np":2,"cix":2,"bm":0,"ix":1,"mn":"ADBE Vector Group","hd":false}],"ip":0,"op":210,"st":0,"ct":1,"bm":0}],"markers":[]};

// Inject special round animation keyframes
if (!document.getElementById('special-round-styles')) {
  const s = document.createElement('style');
  s.id = 'special-round-styles';
  s.textContent = `
@keyframes specialGradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes specialPulseOpacity {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.4; }
}`;
  document.head.appendChild(s);
}

// ============================================
// CONSTANTS
// ============================================

const QUIZ_SESSIONS_PATH = 'quiz_sessions';
const STUDENT_SESSION_KEY = 'vivid-student-session';
const STUDENT_IDENTITY_KEY = 'vivid-student-identity';

// ============================================
// TYPES
// ============================================

interface StudentData {
  name: string;
  schoolName?: string;
  joinedAt: string;
  currentSlide: number;
  responses: SlideResponse[];
  isOnline: boolean;
  isFocused?: boolean;
  lastSeen: string;
  deviceId: string;
  // Time tracking
  startTime?: string;
  totalTimeMs?: number;
}

interface SavedSession {
  sessionId: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  joinedAt: string;
}

interface StudentIdentity {
  id: string;
  name: string;
  createdAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate a unique device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem('vivid-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('vivid-device-id', deviceId);
  }
  return deviceId;
}

// Get or create student identity
function getStudentIdentity(name?: string): StudentIdentity {
  const saved = localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (saved) {
    const identity = JSON.parse(saved) as StudentIdentity;
    // Update name if provided and different
    if (name && name !== identity.name) {
      identity.name = name;
      localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  }
  
  // Create new identity
  const newIdentity: StudentIdentity = {
    id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || '',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

// Save active session
function saveActiveSession(session: SavedSession): void {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

// Get saved session
function getSavedSession(): SavedSession | null {
  const saved = localStorage.getItem(STUDENT_SESSION_KEY);
  return saved ? JSON.parse(saved) : null;
}

// Clear saved session
function clearSavedSession(): void {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

// Retry wrapper for Firebase operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizJoinPage() {
  const [searchParams] = useSearchParams();
  const { code: urlCode } = useParams<{ code?: string }>();
  const initialCode = urlCode || searchParams.get('code') || '';
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Join state
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [boardTitle, setBoardTitle] = useState<string | null>(null);
  const [isLookingUpBoard, setIsLookingUpBoard] = useState(false);
  
  // Session state
  const [isJoined, setIsJoined] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  
  // Track scrolling for floating nav visibility (must be after isJoined is defined)
  useEffect(() => {
    if (!isJoined || !isMobile) return;
    
    // Wait a bit for ref to be set after render
    const timeout = setTimeout(() => {
      const scrollEl = mobileScrollRef.current;
      if (!scrollEl) return;
      
      const handleScroll = () => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2000);
      };
      
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });
      
      // Cleanup stored for outer effect
      (scrollEl as any)._scrollHandler = handleScroll;
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      const scrollEl = mobileScrollRef.current;
      if (scrollEl && (scrollEl as any)._scrollHandler) {
        scrollEl.removeEventListener('scroll', (scrollEl as any)._scrollHandler);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [isMobile, isJoined]);
  
  // Quiz progress
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [formAnswer, setFormAnswer] = useState<Record<string, string | string[]>>({});
  const [showResult, setShowResult] = useState(false);
  
  
  // Tactical: two-step treasure choice (first pick risk, then see options)
  const [showTreasureOptions, setShowTreasureOptions] = useState(false);

  // Local slide index for unlocked mode
  const [localSlideIndex, setLocalSlideIndex] = useState(0);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [slideStartTime, setSlideStartTime] = useState<number>(Date.now());
  
  // Wiggle animation for answer button
  const [showWiggle, setShowWiggle] = useState(false);
  const answerButtonRef = useRef<HTMLButtonElement | null>(null);
  
  // Refs for cleanup and state tracking
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionUnsubscribe = useRef<(() => void) | null>(null);
  const responsesRef = useRef<SlideResponse[]>(responses);
  
  // Keep ref in sync with state
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // ============================================
  // COMPUTED: ONLINE STUDENTS COUNT
  // ============================================
  
  const onlineStudentsCount = session?.students 
    ? Object.values(session.students).filter((s: any) => s.isOnline).length 
    : 0;

  // ============================================
  // NETWORK STATUS MONITORING
  // ============================================
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
      // Trigger reconnect if we were in a session
      if (sessionId && studentId) {
        reconnectToSession();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionError('Ztráta připojení k internetu');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionId, studentId]);

  // ============================================
  // LIVE BOARD TITLE LOOKUP
  // ============================================
  
  useEffect(() => {
    // Only lookup when code is complete (6 chars)
    if (code.length !== 6) {
      setBoardTitle(null);
      return;
    }
    
    const lookupBoardTitle = async () => {
      setIsLookingUpBoard(true);
      try {
        // Try lookup table first
        const codeUpper = code.toUpperCase();
        const lookupRef = ref(database, `session_codes/${codeUpper}`);
        const lookupSnapshot = await get(lookupRef);
        
        if (lookupSnapshot.exists()) {
          const sessionId = lookupSnapshot.val() as string;
          const quizDataRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/quizData/title`);
          const titleSnapshot = await get(quizDataRef);
          if (titleSnapshot.exists()) {
            setBoardTitle(titleSnapshot.val() as string);
            setIsLookingUpBoard(false);
            return;
          }
        }
        
        // Fallback: search all sessions (slower)
        const sessionsRef = ref(database, QUIZ_SESSIONS_PATH);
        const snapshot = await get(sessionsRef);
        if (snapshot.exists()) {
          const sessions = snapshot.val();
          const entry = Object.entries(sessions).find(([id]) => 
            id.includes(`quiz_${codeUpper}_`)
          );
          if (entry) {
            const [, sessionData] = entry as [string, any];
            if (sessionData?.quizData?.title) {
              setBoardTitle(sessionData.quizData.title);
            }
          }
        }
      } catch (e) {
        console.log('Board title lookup failed:', e);
      } finally {
        setIsLookingUpBoard(false);
      }
    };
    
    lookupBoardTitle();
  }, [code]);

  // ============================================
  // AUTO-RECONNECT ON PAGE LOAD
  // ============================================
  
  useEffect(() => {
    const savedSession = getSavedSession();
    const identity = getStudentIdentity();
    
    // Pre-fill name from identity
    if (identity.name && !name) {
      setName(identity.name);
    }
    
    // If URL has a code, check if it matches the saved session
    if (initialCode && savedSession) {
      // Extract session code from saved session ID (format: quiz_XXXXXX_timestamp)
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      
      if (savedCode && savedCode.toUpperCase() !== initialCode.toUpperCase()) {
        // URL code is different from saved session - clear saved and use URL code
        console.log('URL code differs from saved session, clearing saved session');
        clearSavedSession();
        return; // Don't auto-reconnect, let user join with URL code
      }
    }
    
    // Try to reconnect to saved session (only if no URL code or URL matches saved)
    if (savedSession) {
      console.log('Found saved session, attempting reconnect:', savedSession);
      attemptReconnect(savedSession);
    }
  }, [initialCode]);

  // Attempt to reconnect to a saved session
  const attemptReconnect = async (savedSession: SavedSession) => {
    setIsReconnecting(true);
    setError('');
    
    try {
      // Check if session still exists and is active
      const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        console.log('Session no longer exists');
        clearSavedSession();
        setIsReconnecting(false);
        return;
      }
      
      const sessionData = snapshot.val() as LiveQuizSession;
      
      if (!sessionData.isActive) {
        console.log('Session has ended');
        // Show results if session ended
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        // Restore student data
        const studentData = sessionData.students?.[savedSession.studentId];
        if (studentData) {
          setResponses(studentData.responses || []);
          setLocalSlideIndex(studentData.currentSlide || 0);
          setName(savedSession.studentName);
        }
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setIsJoined(true);
        setIsReconnecting(false);
        return;
      }
      
      // Check if student record still exists
      const studentData = sessionData.students?.[savedSession.studentId];
      
      if (studentData) {
        console.log('Reconnecting to existing student record');
        // Restore state from Firebase
        setResponses(studentData.responses || []);
        setLocalSlideIndex(studentData.currentSlide || 0);
        setName(savedSession.studentName);
        
        // Update online status
        await retryOperation(() => 
          update(ref(database, `${QUIZ_SESSIONS_PATH}/${savedSession.sessionId}/students/${savedSession.studentId}`), {
            isOnline: true,
            isFocused: true,
            lastSeen: new Date().toISOString(),
            deviceId: getDeviceId(),
          })
        );
        
        // Set session state
        setSessionId(savedSession.sessionId);
        setStudentId(savedSession.studentId);
        setSession(sessionData);
        if (sessionData.quizData) {
          setQuiz(sessionData.quizData as Quiz);
        }
        setIsJoined(true);
      } else {
        console.log('Student record not found, clearing saved session');
        clearSavedSession();
      }
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
      clearSavedSession();
    } finally {
      setIsReconnecting(false);
    }
  };

  // Manual reconnect
  const reconnectToSession = async () => {
    if (!sessionId || !studentId) return;
    
    setIsReconnecting(true);
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          isOnline: true,
          isFocused: document.visibilityState === 'visible',
          lastSeen: new Date().toISOString(),
        })
      );
      setConnectionError(null);
    } catch (error) {
      console.error('Reconnect failed:', error);
      setConnectionError('Nepodařilo se obnovit připojení');
    } finally {
      setIsReconnecting(false);
    }
  };

  // ============================================
  // SESSION LISTENER
  // ============================================
  
  useEffect(() => {
    if (!sessionId) return;
    
    const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSession(data as LiveQuizSession);
        setConnectionError(null);
        
        // Load quiz from Firebase session data
        if (data.quizData && !quiz) {
          console.log('Loading quiz from Firebase:', data.quizData);
          setQuiz(data.quizData as Quiz);
        }
        
        // Sync responses from server (in case of multi-device or teacher evaluation)
        if (studentId && data.students?.[studentId]) {
          const serverResponses = data.students[studentId].responses || [];
          const currentResponses = responsesRef.current;
          // Update if server has more responses OR if any isCorrect value has changed (teacher evaluated)
          const hasNewResponses = serverResponses.length > currentResponses.length;
          const hasEvaluationChanged = serverResponses.some((sr: any, idx: number) => {
            const localResponse = currentResponses[idx];
            return localResponse && sr.isCorrect !== localResponse.isCorrect;
          });
          if (hasNewResponses || hasEvaluationChanged) {
            setResponses(serverResponses);
          }
        }
      }
    }, (error) => {
      console.error('Session listener error:', error);
      setConnectionError('Ztráta spojení se serverem');
    });
    
    sessionUnsubscribe.current = () => off(sessionRef);
    
    return () => {
      off(sessionRef);
      sessionUnsubscribe.current = null;
    };
  }, [sessionId, studentId, quiz]);

  // ============================================
  // HEARTBEAT - Keep online status updated
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const updateHeartbeat = async () => {
      try {
        await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          lastSeen: new Date().toISOString(),
          isOnline: true,
        });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    };
    
    // Update immediately
    updateHeartbeat();
    
    // Optimized: 45s heartbeat for better scalability with many students
    heartbeatInterval.current = setInterval(updateHeartbeat, 45000);
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [sessionId, studentId]);

  // ============================================
  // ONLINE/FOCUS STATUS
  // ============================================
  
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update (if supported)
      const url = 'https://' + (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'your-project') + '.firebaseio.com/' + QUIZ_SESSIONS_PATH + '/' + sessionId + '/students/' + studentId + '.json';
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, JSON.stringify({ isOnline: false }));
      }
      update(studentRef, { isOnline: false });
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      update(studentRef, { isOnline: false });
    };
  }, [sessionId, studentId]);
  
  // Track focus/visibility
  useEffect(() => {
    if (!sessionId || !studentId) return;
    
    const studentRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`);
    
    const handleVisibilityChange = () => {
      const isFocused = document.visibilityState === 'visible';
      update(studentRef, { isFocused, lastSeen: new Date().toISOString() });
    };
    
    const handleBlur = () => {
      update(studentRef, { isFocused: false, lastSeen: new Date().toISOString() });
    };
    
    const handleFocus = () => {
      update(studentRef, { isFocused: true, lastSeen: new Date().toISOString() });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [sessionId, studentId]);

  // ============================================
  // SYNC SLIDE INDEX
  // ============================================
  
  useEffect(() => {
    if (session?.isLocked !== false && session?.currentSlideIndex !== undefined) {
      // Trigger animation when teacher changes slide
      if (session.currentSlideIndex !== localSlideIndex) {
        setPrevSlideIndex(localSlideIndex);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      }
      
      setLocalSlideIndex(session.currentSlideIndex);
      
      if (sessionId && studentId) {
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          currentSlide: session.currentSlideIndex,
        });
      }
    }
  }, [session?.currentSlideIndex, session?.isLocked, sessionId, studentId]);
  
  // Reset selection and start time when slide changes
  const effectiveSlideIndex = session?.isLocked === false ? localSlideIndex : (session?.currentSlideIndex || 0);
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
    setShowTreasureOptions(false);
    setSlideStartTime(Date.now()); // Reset slide timer
  }, [effectiveSlideIndex]);

  // ============================================
  // JOIN SESSION
  // ============================================
  
  const joinSession = async () => {
    if (!code || !name) {
      setError('Vyplň kód a jméno');
      return;
    }
    
    // Clear any saved session that doesn't match the code being joined
    const savedSession = getSavedSession();
    if (savedSession) {
      const savedCodeMatch = savedSession.sessionId.match(/quiz_([A-Z0-9]+)_/);
      const savedCode = savedCodeMatch ? savedCodeMatch[1] : null;
      if (!savedCode || savedCode.toUpperCase() !== code.toUpperCase()) {
        console.log('Clearing old session before joining new one');
        clearSavedSession();
      }
    }
    
    setIsJoining(true);
    setError('');
    
    try {
      // Get or create student identity
      const identity = getStudentIdentity(name);
      
      // OPTIMIZED: First try to find session via lookup table
      const codeUpper = code.toUpperCase();
      const lookupRef = ref(database, `session_codes/${codeUpper}`);
      const lookupSnapshot = await get(lookupRef);
      
      let foundSessionId: string | null = null;
      let sessionData: LiveQuizSession | null = null;
      
      if (lookupSnapshot.exists()) {
        // Fast path: Use lookup table
        foundSessionId = lookupSnapshot.val() as string;
        const sessionRef = ref(database, `${QUIZ_SESSIONS_PATH}/${foundSessionId}`);
        const sessionSnapshot = await get(sessionRef);
        if (sessionSnapshot.exists()) {
          sessionData = sessionSnapshot.val() as LiveQuizSession;
        }
      }
      
      // Fallback: Search by session ID prefix (for older sessions without lookup)
      if (!foundSessionId || !sessionData) {
        console.log('[QuizJoin] Lookup not found, using prefix search...');
        const sessionsRef = ref(database, QUIZ_SESSIONS_PATH);
        const snapshot = await get(sessionsRef);
        
        if (snapshot.exists()) {
          const sessions = snapshot.val();
          const sessionEntry = Object.entries(sessions).find(([id, _]) => 
            id.includes(`quiz_${codeUpper}_`)
          );
          
          if (sessionEntry) {
            [foundSessionId, sessionData] = sessionEntry as [string, LiveQuizSession];
          }
        }
      }
      
      if (!foundSessionId || !sessionData) {
        setError('Neplatný kód');
        setIsJoining(false);
        return;
      }
      
      if (!sessionData.isActive) {
        setError('Session již skončila');
        setIsJoining(false);
        return;
      }
      
      // Check if student already exists in this session (by name)
      let existingStudentId: string | null = null;
      if (sessionData.students) {
        const existingEntry = Object.entries(sessionData.students).find(
          ([_, student]) => student.name.toLowerCase() === name.toLowerCase()
        );
        if (existingEntry) {
          existingStudentId = existingEntry[0];
          console.log('Found existing student record by name:', existingStudentId);
        }
      }
      
      const finalStudentId = existingStudentId || identity.id;
      
      // Prepare student data
      const studentData: StudentData = {
        name,
        schoolName: school || '',
        joinedAt: existingStudentId 
          ? (sessionData.students![existingStudentId].joinedAt || new Date().toISOString())
          : new Date().toISOString(),
        currentSlide: existingStudentId 
          ? (sessionData.students![existingStudentId].currentSlide || 0)
          : 0,
        responses: existingStudentId 
          ? (sessionData.students![existingStudentId].responses || [])
          : [],
        isOnline: true,
        isFocused: true,
        lastSeen: new Date().toISOString(),
        deviceId: getDeviceId(),
        // Time tracking - preserve existing startTime or set new one
        startTime: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).startTime || new Date().toISOString())
          : new Date().toISOString(),
        totalTimeMs: existingStudentId
          ? ((sessionData.students![existingStudentId] as any).totalTimeMs || 0)
          : 0,
      };
      
      // Save/update student in Firebase
      await retryOperation(() =>
        set(ref(database, `${QUIZ_SESSIONS_PATH}/${foundSessionId}/students/${finalStudentId}`), studentData)
      );
      
      // Save session to localStorage for reconnect
      saveActiveSession({
        sessionId: foundSessionId,
        sessionCode: code.toUpperCase(),
        studentId: finalStudentId,
        studentName: name,
        joinedAt: studentData.joinedAt,
      });
      
      // Load quiz from Firebase session
      if ((sessionData as any).quizData) {
        setQuiz((sessionData as any).quizData as Quiz);
      }
      
      // Restore responses if reconnecting
      if (existingStudentId && studentData.responses.length > 0) {
        setResponses(studentData.responses);
        setLocalSlideIndex(studentData.currentSlide);
      }
      
      setSessionId(foundSessionId);
      setStudentId(finalStudentId);
      setIsJoined(true);
      setIsJoining(false);
      
    } catch (err) {
      console.error('Join error:', err);
      setError('Nepodařilo se připojit. Zkus to znovu.');
      setIsJoining(false);
    }
  };

  // ============================================
  // SUBMIT ANSWER
  // ============================================
  
  const submitAnswer = useCallback(async () => {
    if (!session || !quiz || !sessionId || !studentId) return;
    
    const slideIndex = session.isLocked === false ? localSlideIndex : session.currentSlideIndex;
    const currentSlideForAnswer = quiz.slides[slideIndex];
    if (!currentSlideForAnswer || currentSlideForAnswer.type !== 'activity') return;
    
    // Check if already answered
    if (responses.some(r => r.slideId === currentSlideForAnswer.id)) {
      setShowResult(true);
      return;
    }
    
    let isCorrect = false;
    let answer: string = '';
    
    if (currentSlideForAnswer.activityType === 'abc') {
      const abcSlide = currentSlideForAnswer as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlideForAnswer.activityType === 'open') {
      const openSlide = currentSlideForAnswer as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'example') {
      const exampleSlide = currentSlideForAnswer as ExampleActivitySlide;
      // Use mathematical comparison for example answers (including alternatives)
      const correctAnswers = [
        ...(exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : []),
        ...(exampleSlide.alternativeAnswers || []).filter(Boolean),
      ];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    } else if (currentSlideForAnswer.activityType === 'form') {
      // Form answers are stored as JSON string
      answer = JSON.stringify(formAnswer);
      isCorrect = true; // Forms are not scored
    }
    
    // Calculate time spent on this slide in seconds
    const timeSpentSeconds = Math.round((Date.now() - slideStartTime) / 1000);
    
    // If showSolutionHints is enabled, set isCorrect immediately
    // Otherwise, let the teacher evaluate via "Vyhodnotit" button
    const shouldShowImmediateResult = session?.settings?.showSolutionHints === true;
    
    const response: SlideResponse = {
      slideId: currentSlideForAnswer.id,
      activityType: currentSlideForAnswer.activityType,
      answer,
      // Set isCorrect immediately if showSolutionHints is enabled, otherwise null until teacher evaluates
      isCorrect: shouldShowImmediateResult ? isCorrect : (null as any),
      points: shouldShowImmediateResult && isCorrect ? 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: timeSpentSeconds,
    };
    
    const newResponses = [...responses, response];
    setResponses(newResponses);
    setShowResult(true);
    
    // Calculate total session time
    const totalTimeMs = Date.now() - sessionStartTime;
    
    // Save to Firebase with retry
    try {
      await retryOperation(() =>
        update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
          responses: newResponses,
          currentSlide: slideIndex,
          lastSeen: new Date().toISOString(),
          totalTimeMs,
        })
      );
    } catch (error) {
      console.error('Failed to save answer:', error);
      setConnectionError('Odpověď se možná neuložila. Zkontroluj připojení.');
    }
  }, [session, quiz, sessionId, studentId, localSlideIndex, responses, selectedOption, textAnswer, formAnswer, slideStartTime, sessionStartTime]);

  // ============================================
  // NAVIGATION
  // ============================================
  
  const goToPrevSlide = async () => {
    if (!quiz || localSlideIndex <= 0 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex - 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };
  
  const goToNextSlide = async () => {
    if (!quiz || localSlideIndex >= quiz.slides.length - 1 || isAnimating) return;
    
    setPrevSlideIndex(localSlideIndex);
    setIsAnimating(true);
    
    const newIndex = localSlideIndex + 1;
    setLocalSlideIndex(newIndex);
    
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 300);
    
    // Scroll to top on mobile - with fallback for older browsers
    try {
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    } catch (e) {
      window.scrollTo(0, 0);
    }
    
    if (sessionId && studentId) {
      await update(ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/students/${studentId}`), {
        currentSlide: newIndex,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const currentSlideIndex = session && session.isLocked === false ? localSlideIndex : (session && session.currentSlideIndex ? session.currentSlideIndex : 0);
  const currentSlide = quiz && quiz.slides ? quiz.slides[currentSlideIndex] : undefined;
  const currentSlideId = currentSlide ? currentSlide.id : '';
  const hasAnswered = responses.some(function(r) { return r.slideId === currentSlideId; });

  // Helper to collect form responses for certificate
  const collectFormResponses = useCallback((): Record<string, Record<string, string | string[]>> => {
    const formResponses: Record<string, Record<string, string | string[]>> = {};
    
    if (quiz) {
      quiz.slides.forEach(slide => {
        if (slide.type === 'activity' && (slide as any).activityType === 'form') {
          const response = responses.find(r => r.slideId === slide.id);
          // Try to parse saved response
          if (response?.answer && typeof response.answer === 'string' && response.answer.trim()) {
            try {
              const parsed = JSON.parse(response.answer);
              if (parsed && typeof parsed === 'object') {
                formResponses[slide.id] = parsed;
              }
            } catch {
              // If not valid JSON, skip
            }
          }
          
          // If formAnswer has data for this slide
          const formSlide = slide as any;
          if (formSlide.fields && formSlide.fields.length > 0) {
            const slideFieldIds = formSlide.fields.map((f: any) => f.id);
            const hasDataForThisSlide = Object.keys(formAnswer).some(key => slideFieldIds.includes(key));
            
            if (hasDataForThisSlide && Object.keys(formAnswer).length > 0) {
              formResponses[slide.id] = formAnswer;
            }
          }
        }
      });
    }
    
    return formResponses;
  }, [quiz, responses, formAnswer]);
  const currentResponse = responses.find(function(r) { return r.slideId === currentSlideId; });
  
  // Board posts for current slide (if it's a board activity)
  const boardPosts = useBoardPosts({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
  });
  
  // Voting for current slide (if it's a voting activity)
  const voting = useVoting({
    sessionId: sessionId,
    slideId: currentSlideId,
    currentUserId: studentId || undefined,
    currentUserName: name || undefined,
  });
  
  // Only count responses where isCorrect has been set by teacher (not null/undefined)
  const correctCount = responses.filter(function(r) { return r.isCorrect === true; }).length;
  const wrongCount = responses.filter(function(r) { return r.isCorrect === false; }).length;
  // Count of answers submitted but not yet evaluated
  const pendingCount = responses.filter(function(r) { return r.isCorrect === null || r.isCorrect === undefined; }).length;
  const canNavigate = session && session.isLocked === false;
  
  // Require answer to proceed (for activity slides)
  const canProceed = !currentSlide || currentSlide.type !== 'activity' || hasAnswered;

  // Preload adjacent slides (previous and next) for faster navigation
  useEffect(() => {
    if (!quiz?.slides) return;
    
    const preloadSlideImages = (slide: QuizSlide | undefined) => {
      if (!slide) return;
      
      const imageUrls: string[] = [];
      
      // Check for media on activity slides
      if ((slide as any).media?.url && (slide as any).media?.type === 'image') {
        imageUrls.push((slide as any).media.url);
      }
      
      // Check for block-based layouts (info slides)
      if (slide.type === 'info') {
        const infoSlide = slide as InfoSlide;
        if (infoSlide.layout?.blocks) {
          infoSlide.layout.blocks.forEach(block => {
            if (block.type === 'image' && block.content) {
              imageUrls.push(block.content);
              if (block.gallery) {
                block.gallery.forEach(url => imageUrls.push(url));
              }
            }
          });
        }
        if (infoSlide.imageUrl) {
          imageUrls.push(infoSlide.imageUrl);
        }
      }
      
      // Check for slide background image
      if ((slide as any).slideBackground?.type === 'image' && (slide as any).slideBackground?.imageUrl) {
        imageUrls.push((slide as any).slideBackground.imageUrl);
      }
      
      // Preload each image
      imageUrls.forEach(url => {
        if (url && url.startsWith('http')) {
          const img = new Image();
          img.src = url;
        }
      });
    };
    
    // Preload previous slide
    if (currentSlideIndex > 0) {
      preloadSlideImages(quiz.slides[currentSlideIndex - 1]);
    }
    
    // Preload next slide
    if (currentSlideIndex < quiz.slides.length - 1) {
      preloadSlideImages(quiz.slides[currentSlideIndex + 1]);
    }
  }, [currentSlideIndex, quiz?.slides]);

  // ============================================
  // WIGGLE ANIMATION - triggers when clicking disabled arrow
  // ============================================
  
  const triggerWiggle = () => {
    // Scroll to the answer button and wiggle it
    try {
      if (answerButtonRef.current) {
        // Try smooth scroll, fall back to instant scroll for older browsers
        if ('scrollBehavior' in document.documentElement.style) {
          answerButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          answerButtonRef.current.scrollIntoView(true);
        }
      }
    } catch (e) {
      // Ignore scroll errors on old browsers
    }
    setShowWiggle(true);
    setTimeout(function() { setShowWiggle(false); }, 800);
  };

  // ============================================
  // RENDER: CONNECTION ERROR BANNER
  // ============================================
  
  const renderConnectionBanner = () => {
    if (!connectionError && isOnline) return null;
    
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Offline - čekám na připojení...</span>
          </>
        ) : connectionError ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionError}</span>
            <button 
              onClick={reconnectToSession}
              className="ml-2 px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30"
            >
              Zkusit znovu
            </button>
          </>
        ) : null}
      </div>
    );
  };

  // ============================================
  // RENDER: RECONNECTING
  // ============================================
  
  if (isReconnecting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Obnovuji připojení...</p>
          <p className="text-slate-400 text-sm mt-2">Chvilku strpení</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: JOIN SCREEN
  // ============================================
  
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              {boardTitle ? (
                <>Připojte se do: <span className="text-indigo-600">{boardTitle}</span></>
              ) : (
                'Připojte se'
              )}
            </h1>
            {!code && (
              <p className="text-slate-500 mt-1">Zadej kód od učitele</p>
            )}
            {isLookingUpBoard && code.length === 6 && (
              <p className="text-slate-400 mt-1 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Hledám relaci...
              </p>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kód relace
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={6}
                className="w-full px-4 py-4 text-center text-3xl font-mono font-bold rounded-2xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none uppercase tracking-[0.5em] transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jméno
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg"
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm text-center flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <button
              onClick={joinSession}
              disabled={isJoining || !code || !name || !isOnline}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7C3AED' }}
            >
              {isJoining ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : !isOnline ? (
                <>
                  <WifiOff className="w-5 h-5" />
                  Čekám na připojení
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Připojit se
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WAITING FOR QUIZ DATA
  // ============================================
  
  if (!quiz || !session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Načítám kvíz...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: SESSION ENDED
  // ============================================
  
  if (!session.isActive) {
    const totalQuestions = quiz.slides.filter(s => s.type === 'activity').length;
    
    // Clear saved session when it ends
    clearSavedSession();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz dokončen!
          </h2>
          
          <div className="bg-slate-50 rounded-2xl p-6 my-6">
            <div className="text-5xl font-bold text-green-600 mb-2">
              {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
            </div>
            <p className="text-slate-600">
              {correctCount} z {totalQuestions} správně
            </p>
          </div>
          
          <p className="text-slate-500">Děkujeme za účast, {name}!</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: PAUSED
  // ============================================
  
  if (session.isPaused) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center p-4">
        {renderConnectionBanner()}
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <Pause className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Kvíz pozastaven
          </h2>
          <p className="text-slate-500">Čekej na pokračování od učitele...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: WAITING FOR SLIDE
  // ============================================
  
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        {renderConnectionBanner()}
        <p className="text-slate-500">Čekám na další otázku...</p>
      </div>
    );
  }

  // ============================================
  // RENDER: COMPETITION MODE (student side)
  // ============================================
  
  if (session.mode === 'competition') {
    const compPhase = session.competitionPhase;
    const compData = session.competitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = compData?.evaluated;
    
    // Helper: load lottie from URL with error handling
    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };
    
    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }
    
    // EVALUATION — student sees dark screen with their answer
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';
      
      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }
      
      // After teacher evaluates, show success/fail
      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {isCorrect ? (
              <>
                <div style={{ width: '60vmin', height: '60vmin' }}>
                  <CompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-emerald-300 mt-4">Správně!</h2>
                <p className="text-emerald-400/60 text-lg mt-2">+1 bod</p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={SAD_LOTTIE_DATA} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }
      
      // Before evaluation — show what the student answered
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
          <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: '#7C3AED' }}>
            {answerLabel}
          </div>
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }
    
    // RESULTS — show student's rank
    if (compPhase === 'results') {
      const scores = compData?.scores || {};
      const sorted = Object.entries(scores).sort(([,a], [,b]) => (b as number) - (a as number));
      const myRank = sorted.findIndex(([id]) => id === studentId) + 1;
      const rankForAnim = Math.min(myRank || 99, 10);
      
      return (
        <div className="flex flex-col h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          {/* "Gratulujeme k N. místu!" at top */}
          <div className="flex items-center justify-center pb-4 flex-shrink-0" style={{ paddingTop: 80 }}>
            <h1 className="text-4xl font-black text-slate-800">Gratulujeme k {myRank}. místu!</h1>
          </div>
          
          {/* Animation — fills remaining space, anchored to bottom */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <div className="absolute bottom-0 left-0 right-0">
              <CompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }
    
    // LOBBY — student waits for start
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na zahájení soutěže...</p>
        </div>
      );
    }
    
    // QUESTION phase — falls through to normal quiz rendering below
    // (student answers normally using the existing quiz UI)
  }

  // ============================================
  // RENDER: TEAM COMPETITION MODE (student side)
  // ============================================

  if (session.mode === 'team-competition') {
    const compPhase = session.competitionPhase;
    const tData = session.teamCompetitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = tData?.evaluated;

    // My team info
    const myTeamId = tData?.studentTeamMap?.[studentId || ''];
    const myTeam = myTeamId ? tData?.teams?.[myTeamId] : null;
    const isActivePlayer = myTeamId ? tData?.activePlayerMap?.[myTeamId] === studentId : false;
    const activePlayerName = myTeamId && tData?.activePlayerMap?.[myTeamId]
      ? session.students?.[tData.activePlayerMap[myTeamId]]?.name || '?'
      : '';
    const roundType = tData?.currentRoundType || 'normal';

    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';

      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }

      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;
        const points = roundType === 'double' ? 2 : 1;
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {myTeam && (
              <div className="flex items-center gap-2 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                <span className="text-2xl">{myTeam.emoji}</span>
                <span className="font-bold text-white">{myTeam.name}</span>
              </div>
            )}
            {isCorrect ? (
              <>
                <div style={{ width: '50vmin', height: '50vmin' }}>
                  <CompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-emerald-300 mt-4">Správně!</h2>
                <p className="text-emerald-400/60 text-lg mt-2">+{points} {points > 1 ? 'body' : 'bod'} pro tým</p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={SAD_LOTTIE_DATA} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  {isActivePlayer && (
                    <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          {myTeam && (
            <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
              <span className="text-xl">{myTeam.emoji}</span>
              <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
            </div>
          )}
          {isActivePlayer ? (
            <>
              <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
              <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: myTeam?.color || '#7C3AED' }}>
                {answerLabel}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-lg">Čekám na vyhodnocení...</p>
          )}
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      const teamsSorted = tData?.teams
        ? Object.entries(tData.teams).sort(([, a], [, b]) => b.score - a.score)
        : [];
      const myTeamRank = teamsSorted.findIndex(([tid]) => tid === myTeamId) + 1;
      const rankForAnim = Math.min(myTeamRank || 99, 10);

      return (
        <div className="flex flex-col lg:flex-row h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          {/* Text section - stacked top on mobile, left 50% on desktop */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 lg:min-h-0" style={{ paddingTop: 60, paddingBottom: 20, flex: '1 1 50%' }}>
            {myTeam && (
              <div className="flex items-center gap-2 mb-3 px-5 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}20` }}>
                <span className="text-2xl">{myTeam.emoji}</span>
                <span className="text-lg font-bold" style={{ color: myTeam.color }}>{myTeam.name}</span>
              </div>
            )}
            <h1 className="text-4xl lg:text-6xl font-black text-slate-800">
              {myTeamRank === 1 ? 'Vyhráli jste!' : `${myTeamRank}. místo!`}
            </h1>
            {/* Desktop: show team scores */}
            <div className="hidden lg:flex flex-col items-center mt-8 gap-2">
              {teamsSorted.map(([tid, team], idx) => (
                <div key={tid} className="flex items-center gap-3 px-5 py-2 rounded-xl" style={{ backgroundColor: tid === myTeamId ? `${team.color}15` : 'transparent' }}>
                  <span className="text-lg font-black text-slate-400 w-6 text-right">{idx + 1}.</span>
                  <span className="text-xl">{team.emoji}</span>
                  <span className="font-bold text-slate-700">{team.name}</span>
                  <span className="font-black text-slate-500 ml-2">{team.score} b.</span>
                </div>
              ))}
            </div>
          </div>
          {/* Animation section - bottom on mobile, right 50% on desktop */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <div className="absolute bottom-0 left-0 right-0 lg:inset-0 lg:flex lg:items-end">
              <CompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }

    // LOBBY — student sees their team
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: myTeam ? `${myTeam.color}18` : '#4E5871' }}>
          {myTeam ? (
            <>
              <div className="rounded-full flex items-center justify-center mb-4" style={{ width: 140, height: 140, backgroundColor: `${myTeam.color}25` }}>
                <span style={{ fontSize: '5rem', lineHeight: 1 }}>{myTeam.emoji}</span>
              </div>
              <h1 className="text-4xl font-black mb-1" style={{ color: myTeam.color }}>{myTeam.name}</h1>
              <p className="text-lg font-medium mb-8" style={{ color: `${myTeam.color}99` }}>Tvůj tým</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                {(myTeam.memberIds || []).map(mid => {
                  const s = session.students?.[mid];
                  return s ? (
                    <span key={mid} className="px-4 py-2 rounded-full text-sm font-bold" style={{ backgroundColor: `${myTeam.color}30`, color: myTeam.color }}>
                      {s.name}{mid === studentId ? ' (ty)' : ''}
                    </span>
                  ) : null;
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{ width: '55vmin', height: '55vmin' }}>
                <CompLottie url={COMP_ASSETS.drum} loop />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
              <p className="text-slate-300">Řadím do týmu...</p>
            </>
          )}
        </div>
      );
    }

    // QUESTION phase — TIP ROUND special case
    if (compPhase === 'question' && tData?.tipRoundActive && !isActivePlayer) {
      const myVote = tData.tipVotes?.[studentId || ''];
      const hasVoted = myVote !== undefined;

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#4E5871' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(135deg, #10B981, #06B6D4, #10B981, #34D399)',
            backgroundSize: '300% 300%',
            animation: 'specialGradientShift 3s ease infinite',
            opacity: 0.25,
          }} />
          <div className="relative z-10 flex flex-col items-center">
          {myTeam && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
              <span className="text-xl">{myTeam.emoji}</span>
              <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-2">Tip kolo!</h2>
          <p className="text-slate-300 mb-6 text-center px-8">
            Myslíš, že <span className="font-bold text-white">{activePlayerName}</span> odpověděl/a správně?
          </p>

          {hasVoted ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: myVote ? '#10b98130' : '#ef444430' }}>
                {myVote ? <ThumbsUp className="w-10 h-10 text-emerald-400" /> : <ThumbsDown className="w-10 h-10 text-red-400" />}
              </div>
              <p className="text-slate-400 text-sm">Hlasováno!</p>
            </div>
          ) : (
            <div className="flex gap-6">
              <button
                onClick={() => {
                  if (studentId) {
                    set(ref(database, `quiz_sessions/${session.id}/teamCompetitionData/tipVotes/${studentId}`), true);
                  }
                }}
                className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: '#10b981' }}
              >
                <ThumbsUp className="w-10 h-10 text-white" />
                <span className="text-xs text-white font-bold">ANO</span>
              </button>
              <button
                onClick={() => {
                  if (studentId) {
                    set(ref(database, `quiz_sessions/${session.id}/teamCompetitionData/tipVotes/${studentId}`), false);
                  }
                }}
                className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: '#ef4444' }}
              >
                <ThumbsDown className="w-10 h-10 text-white" />
                <span className="text-xs text-white font-bold">NE</span>
              </button>
            </div>
          )}
          </div>
        </div>
      );
    }

    // QUESTION phase — not active player (waiting)
    if (compPhase === 'question' && !isActivePlayer && roundType !== 'power') {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#4E5871' }}>
          {roundType === 'double' && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B, #FF6B00)',
              backgroundSize: '300% 300%',
              animation: 'specialGradientShift 3s ease infinite, specialPulseOpacity 2s ease-in-out infinite',
            }} />
          )}
          <div className="relative z-10 flex flex-col items-center">
            {roundType === 'double' && (
              <div className="flex items-center gap-2 mb-4 px-5 py-2.5 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(245,158,11,0.3)' }}>
                <span className="text-2xl font-black text-amber-300">x2</span>
                <span className="text-white font-bold text-sm">Dvojité body!</span>
              </div>
            )}
            {myTeam && (
              <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full" style={{ backgroundColor: `${myTeam.color}30` }}>
                <span className="text-xl">{myTeam.emoji}</span>
                <span className="font-bold text-sm" style={{ color: myTeam.color }}>{myTeam.name}</span>
              </div>
            )}
            <p className="text-slate-300 text-lg mb-2">Odpovídá</p>
            <h2 className="text-3xl font-bold text-white mb-6">{activePlayerName}</h2>
            <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgba(124,58,237,0.3)' }}>
              <Users className="w-8 h-8 text-white" />
            </div>
            <p className="text-slate-400 text-sm mt-6">Drž palce!</p>
          </div>
        </div>
      );
    }

    // QUESTION phase — active player OR power round (everyone answers)
    // Falls through to normal quiz rendering below
  }

  // ============================================
  // RENDER: DUEL COMPETITION MODE (student side)
  // ============================================

  if (session.mode === 'duel-competition') {
    const compPhase = session.competitionPhase;
    const dData = session.duelCompetitionData;
    const currentQSlide = currentSlide;
    const myResponse = currentQSlide ? responses.find(r => r.slideId === currentQSlide.id) : null;
    const evaluated = dData?.evaluated;

    const myDuelId = dData?.studentDuelMap?.[studentId || ''];
    const myDuel = myDuelId ? dData?.duels?.[myDuelId] : null;
    const opponents = myDuel ? myDuel.playerIds.filter(pid => pid !== studentId) : [];
    const opponentNames = opponents.map(pid => session.students?.[pid]?.name || '?');
    const isTriple = myDuel ? myDuel.playerIds.length > 2 : false;
    const myScore = myDuel?.scores?.[studentId || ''] || 0;

    const DuelCompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <DuelCompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION
    if (compPhase === 'evaluation') {
      const myAnswer = myResponse?.answer;
      let answerLabel = myAnswer ? String(myAnswer) : 'Neodpovězeno';

      if (currentQSlide && (currentQSlide as any).activityType === 'abc') {
        const optIdx = ((currentQSlide as any).options || []).findIndex((o: any) => o.id === myAnswer);
        answerLabel = optIdx >= 0 ? String.fromCharCode(65 + optIdx) : 'Neodpovězeno';
      }

      if (evaluated && myResponse) {
        const isCorrect = myResponse.isCorrect;

        // Check if I won this round vs opponents
        const opponentResults = opponents.map(pid => {
          const s = session.students?.[pid];
          const resp = (s?.responses || []).find((r: any) => r.slideId === currentQSlide?.id);
          return resp?.isCorrect || false;
        });
        const allOpponentsWrong = opponentResults.every(r => !r);
        const iWon = isCorrect && allOpponentsWrong;

        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: isCorrect ? '#00DE69' : '#dc2626' }}>
            {/* Duel score badge */}
            <div className="flex items-center gap-3 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
              <span className="font-bold text-white">{name}</span>
              <span className="text-2xl font-black text-white">{myScore}</span>
              <span className="font-black text-white/60">:</span>
              {opponents.map((pid, i) => (
                <React.Fragment key={pid}>
                  <span className="text-2xl font-black text-white">{myDuel?.scores?.[pid] || 0}</span>
                  <span className="font-bold text-white">{opponentNames[i]}</span>
                </React.Fragment>
              ))}
            </div>

            {isCorrect ? (
              <>
                <div style={{ width: '50vmin', height: '50vmin' }}>
                  <DuelCompLottie url={COMP_ASSETS.celebrate} loop={false} />
                </div>
                <h2 className="text-4xl font-black text-white mt-4">
                  {iWon ? 'Jen ty správně!' : 'Správně!'}
                </h2>
                <p className="text-white/60 text-lg mt-2">
                  {iWon ? '+2 body!' : '+1 bod'}
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div style={{ width: '45vmin', height: '45vmin' }}>
                    <Lottie animationData={SAD_LOTTIE_DATA} loop autoplay />
                  </div>
                  <h2 className="text-4xl font-black text-white/90 mt-2">Škoda!</h2>
                  <p className="text-white/40 text-lg mt-2">Příště to bude lepší</p>
                  <div className="mt-5 px-6 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-white/50 text-sm">Tvá odpověď: <span className="font-bold text-white/70">{answerLabel}</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      }

      // Waiting for evaluation
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="flex items-center gap-3 mb-6 px-5 py-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <span className="font-bold text-white">{name}</span>
            <span className="text-2xl font-black text-white">{myScore}</span>
            <span className="font-black text-white/60">:</span>
            {opponents.map((pid, i) => (
              <React.Fragment key={pid}>
                <span className="text-2xl font-black text-white">{myDuel?.scores?.[pid] || 0}</span>
                <span className="font-bold text-white">{opponentNames[i]}</span>
              </React.Fragment>
            ))}
          </div>
          <p className="text-slate-400 text-lg mb-4">Tvá odpověď</p>
          <div className="px-8 py-4 rounded-2xl text-3xl font-bold text-white" style={{ backgroundColor: '#FF6B35' }}>
            {answerLabel}
          </div>
          <p className="text-slate-500 text-sm mt-6">Čekám na vyhodnocení...</p>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      if (!myDuel) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
            <h1 className="text-3xl font-bold text-slate-800">Soutěž skončila!</h1>
          </div>
        );
      }

      // Determine my rank in the duel
      const sorted = [...myDuel.playerIds].sort((a, b) => (myDuel.scores[b] || 0) - (myDuel.scores[a] || 0));
      const myRank = sorted.indexOf(studentId || '') + 1;
      const topScore = myDuel.scores[sorted[0]] || 0;
      const isTie = sorted.length > 1 && myScore === topScore && myScore > 0;
      const iWon = myRank === 1 && !isTie && topScore > 0;
      const rankForAnim = iWon ? 1 : isTie ? 2 : Math.min(myRank + 1, 10);

      return (
        <div className="flex flex-col lg:flex-row h-screen w-full" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex flex-col items-center justify-center flex-shrink-0 lg:min-h-0" style={{ paddingTop: 60, paddingBottom: 20, flex: '1 1 50%' }}>
            <h1 className="text-4xl lg:text-6xl font-black text-slate-800 mb-4">
              {iWon ? 'Vyhrál/a jsi!' : isTie ? 'Remíza!' : 'Prohrál/a jsi'}
            </h1>

            {/* Duel final score */}
            <div className="flex items-center gap-4 mb-8">
              {myDuel.playerIds.map((pid, i) => {
                const s = session.students?.[pid];
                const isMe = pid === studentId;
                return (
                  <React.Fragment key={pid}>
                    {i > 0 && <span className="text-2xl font-black text-slate-300">:</span>}
                    <div className="flex flex-col items-center">
                      <span className={`text-5xl font-black ${isMe ? 'text-orange-500' : 'text-slate-400'}`}>
                        {myDuel.scores[pid] || 0}
                      </span>
                      <span className={`text-sm font-bold mt-1 ${isMe ? 'text-orange-500' : 'text-slate-400'}`}>
                        {isMe ? name : s?.name || '?'}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0, flex: '1 1 50%' }}>
            <div className="absolute bottom-0 left-0 right-0 lg:inset-0 lg:flex lg:items-end">
              <DuelCompLottie url={COMP_ASSETS.rank(rankForAnim)} loop className="w-full" />
            </div>
          </div>
        </div>
      );
    }

    // LOBBY
    if (compPhase === 'lobby' || !compPhase) {
      if (myDuel) {
        // Duels created: show VS screen
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#1e2533' }}>
            {/* Pulsing background */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(135deg, #FF6B35, #EF4444, #FF6B35, #F59E0B)',
              backgroundSize: '300% 300%',
              animation: 'specialGradientShift 3s ease infinite',
              opacity: 0.15,
            }} />
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-lg font-bold text-white/60 mb-8 uppercase tracking-widest">Tvůj souboj</h2>
              <div className="flex items-center gap-6">
                {/* My name */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: '#FF6B35' }}>
                    {(name || '?')[0]?.toUpperCase()}
                  </div>
                  <span className="text-white font-bold mt-3 text-lg">{name}</span>
                  <span className="text-xs text-white/40">(ty)</span>
                </div>

                <span className="text-4xl font-black" style={{ color: '#FF6B35' }}>VS</span>

                {/* Opponents */}
                {opponents.map((pid, i) => {
                  const oppName = opponentNames[i];
                  return (
                    <React.Fragment key={pid}>
                      {i > 0 && <span className="text-4xl font-black" style={{ color: '#FF6B35' }}>VS</span>}
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: '#EF4444' }}>
                          {(oppName || '?')[0]?.toUpperCase()}
                        </div>
                        <span className="text-white font-bold mt-3 text-lg">{oppName}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <p className="text-slate-400 text-sm mt-10">Čekám na zahájení...</p>
            </div>
          </div>
        );
      }

      // Waiting to be paired
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na rozlosování...</p>
        </div>
      );
    }

    // QUESTION phase — falls through to normal quiz rendering below
    // The VS banner will be added separately
  }

  // ============================================
  // TACTICAL COMPETITION MODE (student view)
  // ============================================
  if (session.mode === 'tactical-competition') {
    const compPhase = session.competitionPhase;
    const tacData = session.tacticalCompetitionData;
    const myScore = tacData?.scores?.[studentId || ''] || 0;
    const myStreak = tacData?.streaks?.[studentId || ''] || 0;
    const myPowerUps = tacData?.powerUps?.[studentId || ''] || {};
    const isBlocked = tacData?.blockedPlayers?.[studentId || ''];
    const myChoice = tacData?.choices?.[studentId || ''];
    const myTreasureOffer = tacData?.treasureOffers?.[studentId || ''];
    const isPowerRound = tacData?.isPowerRound;
    const basePoints = isPowerRound ? 6 : 3;
    const streakBonus = myStreak >= 3 ? 1 : 0;

    const TREASURE_INFO_LOCAL: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
      double: { emoji: '💰', label: 'Dvojnásobek', desc: `+${(basePoints + streakBonus) * 2} bodů místo ${basePoints + streakBonus}`, color: '#F59E0B' },
      sabotage: { emoji: '💣', label: 'Sabotáž', desc: `Uber ${isPowerRound ? 5 : 3} body soupeři`, color: '#EF4444' },
      block: { emoji: '🚫', label: 'Blokáda', desc: 'Zablokuj soupeře na kolo', color: '#8B5CF6' },
      shield: { emoji: '🛡️', label: 'Štít', desc: 'Ochrana před sabotáží', color: '#3B82F6' },
      xray: { emoji: '👁️', label: 'Rentgen', desc: 'Uvidíš správnou odpověď', color: '#10B981' },
      timeBoost: { emoji: '⏰', label: 'Čas+', desc: '+15s na příští otázku', color: '#06B6D4' },
    };

    const CompLottie = ({ url, loop = true, className = '' }: { url: string; loop?: boolean; className?: string }) => {
      const [data, setData] = React.useState<any>(null);
      const [err, setErr] = React.useState(false);
      React.useEffect(() => {
        setData(null); setErr(false);
        fetch(url)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(json => { if (json && (json.layers || json.assets)) setData(json); else setErr(true); })
          .catch(() => setErr(true));
      }, [url]);
      if (err || !data) return null;
      return <Lottie animationData={data} loop={loop} autoplay className={className} />;
    };

    // Helper: student picks "safe points" — adds base points
    const chooseSafePoints = () => {
      if (!tacData || !studentId) return;
      const points = basePoints + streakBonus;
      const updatedScores = { ...tacData.scores, [studentId]: (tacData.scores[studentId] || 0) + points };
      const updatedChoices = { ...tacData.choices, [studentId]: 'points' as const };
      update(ref(database, `quiz_sessions/${session.id}`), {
        tacticalCompetitionData: { ...tacData, scores: updatedScores, choices: updatedChoices },
      });
    };

    // Helper: student picks a treasure INSTEAD of safe points
    const chooseTreasure = (treasure: TreasureType) => {
      if (!tacData || !studentId || !myTreasureOffer) return;
      const updatedOffers = { ...tacData.treasureOffers, [studentId]: { ...myTreasureOffer, picked: treasure } };

      if (treasure === 'sabotage' || treasure === 'block') {
        // Keep choice as 'pending' — target selection screen comes next
        update(ref(database, `quiz_sessions/${session.id}`), {
          tacticalCompetitionData: {
            ...tacData,
            treasureOffers: updatedOffers,
          },
        });
        return;
      }

      // Non-targeted treasures: apply effect and mark as 'treasure'
      const updatedChoices = { ...tacData.choices, [studentId]: 'treasure' as const };
      let updatedScores = { ...tacData.scores };
      let updatedPowerUps = { ...tacData.powerUps };
      let updatedEvents = [...(tacData.events || [])];
      const myName = name || '?';

      if (treasure === 'double') {
        // Give 2x the base points instead of 1x
        const doublePoints = (basePoints + streakBonus) * 2;
        updatedScores[studentId] = (updatedScores[studentId] || 0) + doublePoints;
        updatedEvents.push({ id: `${Date.now()}`, type: 'double', fromName: myName, points: doublePoints, timestamp: new Date().toISOString() });
      } else if (treasure === 'shield') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], shield: true };
      } else if (treasure === 'xray') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], xray: true };
      } else if (treasure === 'timeBoost') {
        updatedPowerUps[studentId] = { ...updatedPowerUps[studentId], timeBoost: true };
      }

      update(ref(database, `quiz_sessions/${session.id}`), {
        tacticalCompetitionData: {
          ...tacData,
          scores: updatedScores,
          choices: updatedChoices,
          treasureOffers: updatedOffers,
          powerUps: updatedPowerUps,
          events: updatedEvents,
        },
      });
    };

    // Helper: apply sabotage/block to a target — finalizes the choice
    const applyTargetedTreasure = (targetId: string) => {
      if (!tacData || !studentId || !myTreasureOffer?.picked) return;
      const treasure = myTreasureOffer.picked;
      let updatedScores = { ...tacData.scores };
      let updatedPowerUps = { ...tacData.powerUps };
      let updatedEvents = [...(tacData.events || [])];
      let updatedBlocked = { ...tacData.blockedPlayers };
      const updatedChoices = { ...tacData.choices, [studentId]: 'treasure' as const };
      const updatedOffers = { ...tacData.treasureOffers, [studentId]: { ...myTreasureOffer, target: targetId } };

      const myName = name || '?';
      const targetName = session.students?.[targetId]?.name || '?';
      const targetHasShield = updatedPowerUps[targetId]?.shield;

      if (treasure === 'sabotage') {
        if (targetHasShield) {
          updatedPowerUps[targetId] = { ...updatedPowerUps[targetId], shield: false };
          updatedEvents.push({ id: `${Date.now()}`, type: 'shield_block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        } else {
          const points = isPowerRound ? 5 : 3;
          updatedScores[targetId] = Math.max(0, (updatedScores[targetId] || 0) - points);
          updatedEvents.push({ id: `${Date.now()}`, type: 'sabotage', fromName: myName, toName: targetName, points, timestamp: new Date().toISOString() });
        }
      } else if (treasure === 'block') {
        if (targetHasShield) {
          updatedPowerUps[targetId] = { ...updatedPowerUps[targetId], shield: false };
          updatedEvents.push({ id: `${Date.now()}`, type: 'shield_block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        } else {
          updatedBlocked[targetId] = myName;
          updatedEvents.push({ id: `${Date.now()}`, type: 'block', fromName: myName, toName: targetName, timestamp: new Date().toISOString() });
        }
      }

      update(ref(database, `quiz_sessions/${session.id}`), {
        tacticalCompetitionData: {
          ...tacData,
          scores: updatedScores,
          choices: updatedChoices,
          powerUps: updatedPowerUps,
          events: updatedEvents,
          blockedPlayers: updatedBlocked,
          treasureOffers: updatedOffers,
        },
      });
    };

    // LOBBY
    if (compPhase === 'lobby' || !compPhase) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '55vmin', height: '55vmin' }}>
            <CompLottie url={COMP_ASSETS.drum} loop />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Připraven!</h1>
          <p className="text-slate-300">Čekám na zahájení soutěže...</p>
        </div>
      );
    }

    // COUNTDOWN
    if (compPhase === 'countdown') {
      return (
        <div className="flex items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div style={{ width: '70vmin', height: '70vmin' }}>
            <CompLottie url={COMP_ASSETS.countdown} loop={false} />
          </div>
        </div>
      );
    }

    // EVALUATION — choice phase for correct answers
    if (compPhase === 'evaluation' && tacData?.evaluated) {
      // Check if student answered correctly
      const currentQSlide = quiz.slides[session.currentSlideIndex];
      const myResponse = (session.students?.[studentId || '']?.responses || []).find(
        (r: any) => r.slideId === currentQSlide?.id
      );
      const wasCorrect = myResponse?.isCorrect;

      // BLOCKED
      if (isBlocked) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-white mb-2">Zablokováno!</h1>
            <p className="text-slate-300">{isBlocked} tě zablokoval na toto kolo</p>
          </div>
        );
      }

      // WRONG ANSWER
      if (!wasCorrect) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#EF4444' }}>
            <div className="text-7xl mb-4">😔</div>
            <h1 className="text-3xl font-bold text-white mb-2">Škoda!</h1>
            <p className="text-white/80">Tentokrát žádné body</p>
            <div className="mt-6 px-6 py-3 rounded-2xl bg-white/20">
              <span className="text-white font-bold text-xl">Skóre: {myScore}</span>
            </div>
          </div>
        );
      }

      // CORRECT — CHOICE PHASE
      if (myChoice === 'pending' && tacData.choicePhaseActive) {
        // Need to pick sabotage/block target?
        if (myTreasureOffer?.picked === 'sabotage' || myTreasureOffer?.picked === 'block') {
          if (!myTreasureOffer?.target) {
            const treasure = myTreasureOffer.picked;
            const info = TREASURE_INFO_LOCAL[treasure];
            const otherStudents = Object.entries(session.students || {}).filter(([id]) => id !== studentId && session.students?.[id]?.isOnline);
            return (
              <div className="flex flex-col items-center justify-center h-screen w-full p-6" style={{ backgroundColor: info.color }}>
                <div className="text-5xl mb-4">{info.emoji}</div>
                <h1 className="text-2xl font-bold text-white mb-2">Vyber cíl!</h1>
                <p className="text-white/80 mb-6">{info.desc}</p>
                <div className="flex flex-wrap gap-3 justify-center max-w-md">
                  {otherStudents.map(([id, s]) => (
                    <button
                      key={id}
                      onClick={() => applyTargetedTreasure(id)}
                      className="px-5 py-3 rounded-xl bg-white/20 text-white font-bold text-lg hover:bg-white/30 transition-all active:scale-95"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
        }

        // Main choice: safe points or treasure (two-step flow)
        // Step 1: Choose between safe points or "risk it"
        if (!showTreasureOptions) {
          return (
          <div className="flex flex-col items-center justify-center h-screen w-full p-5" style={{
            backgroundColor: isPowerRound ? '#F59E0B' : '#10B981',
          }}>
            <div className="text-7xl mb-3">🎉</div>
            <h1 className="text-4xl font-black text-white mb-2">Správně!</h1>
            {myStreak >= 3 && (
              <div className="px-4 py-1 rounded-full mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <span className="text-yellow-300 font-bold text-sm">🔥 Série {myStreak}!</span>
              </div>
            )}
            <p className="text-white/80 font-bold text-xl mb-5">Co si vybereš?</p>

              <div className="w-full max-w-sm flex flex-col gap-4">
                {/* Take points */}
            <button
              onClick={chooseSafePoints}
              className="w-full px-6 py-7 rounded-3xl transition-all active:scale-95 text-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
            >
              <div className="text-5xl font-black" style={{ color: '#059669' }}>+{basePoints + streakBonus} bodů</div>
              <p className="text-slate-400 text-base mt-2 font-medium">Jistota</p>
            </button>

                {/* Risk it — open treasure instead */}
                <button
                  onClick={() => setShowTreasureOptions(true)}
                  className="w-full px-6 py-7 rounded-3xl transition-all active:scale-95 text-center"
                  style={{ backgroundColor: '#7C3AED' }}
                >
                  <div className="text-5xl mb-1">🎲</div>
                  <div className="text-2xl font-black text-white">Otevřít truhlu!</div>
                  <p className="text-white/70 text-sm mt-1">Žádné body, ale bonus!</p>
                </button>
              </div>

            </div>
          );
        }

        // Step 2: Pick a treasure
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full p-5" style={{
            backgroundColor: '#4C1D95',
          }}>
            <h1 className="text-3xl font-black text-white mb-6" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>Vyber si bonus!</h1>

            <div className="flex flex-col gap-4 w-full max-w-md">
              {(myTreasureOffer?.options || []).map((t: TreasureType) => {
                const info = TREASURE_INFO_LOCAL[t];
                return (
                  <button
                    key={t}
                    onClick={() => { chooseTreasure(t); setShowTreasureOptions(false); }}
                    className="w-full flex items-center gap-5 px-6 py-6 rounded-2xl transition-all active:scale-95"
                    style={{
                      backgroundColor: info.color,
                    }}
                  >
                    <span className="text-5xl flex-shrink-0">{info.emoji}</span>
                    <div className="flex-1 text-left">
                      <div className="text-2xl font-black text-white">{info.label}</div>
                      <div className="text-white/80 text-sm mt-0.5">{info.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowTreasureOptions(false)}
              className="mt-6 text-white/50 text-sm hover:text-white/80 transition-colors"
            >
              ← Zpět na body
            </button>

          </div>
        );
      }

      // Already chose
      if (myChoice === 'points') {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#10B981' }}>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">Body přidány!</h1>
            <div className="mt-4 px-8 py-4 rounded-2xl bg-white/20">
              <span className="text-white font-black text-3xl">{myScore}</span>
              <span className="text-white/70 text-lg ml-2">bodů</span>
            </div>
          </div>
        );
      }

      if (myChoice === 'treasure' && myTreasureOffer?.picked) {
        const info = TREASURE_INFO_LOCAL[myTreasureOffer.picked];
        return (
          <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: info.color }}>
            <div className="text-7xl mb-4">{info.emoji}</div>
            <h1 className="text-2xl font-bold text-white mb-2">{info.label}!</h1>
            <p className="text-white/80">{info.desc}</p>
            {myTreasureOffer.target && (
              <p className="text-white font-bold mt-2">→ {session.students?.[myTreasureOffer.target]?.name}</p>
            )}
            <div className="mt-6 px-8 py-4 rounded-2xl bg-white/20">
              <span className="text-white font-black text-3xl">{myScore}</span>
              <span className="text-white/70 text-lg ml-2">bodů</span>
            </div>
          </div>
        );
      }

      // Default evaluation (waiting for teacher to evaluate)
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-white">Vyhodnocuji...</h1>
        </div>
      );
    }

    // EVALUATION — waiting for teacher to evaluate
    if (compPhase === 'evaluation' && !tacData?.evaluated) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full" style={{ backgroundColor: '#4E5871' }}>
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-white">Čekám na vyhodnocení...</h1>
        </div>
      );
    }

    // RESULTS
    if (compPhase === 'results') {
      const allScores = Object.entries(tacData?.scores || {})
        .map(([id, score]) => ({ id, name: session.students?.[id]?.name || '?', score: score as number }))
        .sort((a, b) => b.score - a.score);
      
      const myRank = allScores.findIndex(s => s.id === studentId) + 1;
      const isWinner = myRank === 1;
      const isTopThree = myRank <= 3;

      return (
        <div className="flex flex-col items-center justify-center h-screen w-full p-6" style={{
          backgroundColor: isWinner ? '#F59E0B' : isTopThree ? '#10B981' : '#4E5871',
        }}>
          {isWinner && (
            <div style={{ width: '50vmin', height: '50vmin', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
              <CompLottie url={COMP_ASSETS.celebrate} loop />
            </div>
          )}
          <h1 className="text-4xl font-black text-white mb-2 relative z-10">
            {isWinner ? '🏆 Vítěz!' : `${myRank}. místo`}
          </h1>
          <div className="text-6xl font-black text-white mb-6 relative z-10">{myScore} bodů</div>
          
          {/* Leaderboard */}
          <div className="w-full max-w-sm relative z-10">
            {allScores.slice(0, 5).map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2 rounded-xl mb-1"
                style={{
                  backgroundColor: entry.id === studentId ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                }}
              >
                <span className="w-6 text-center font-bold text-white">{i + 1}.</span>
                <span className="flex-1 text-white font-medium">{entry.name}</span>
                <span className="text-white font-black">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // QUESTION — show power round indicator and power-up status, then fall through to normal quiz
    // (handled by floating banners below)
  }
  
  // ============================================
  // RENDER: PROGRESS BAR
  // ============================================
  
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const progressPercent = totalSlides > 0 ? ((currentSlideIndex + 1) / totalSlides) * 100 : 0;
    
    // For more than 30 slides, show a simple continuous progress bar
    if (totalSlides > 30) {
      return (
        <div 
          className="flex-1 h-full rounded-full overflow-hidden"
          style={{ backgroundColor: '#CBD5E1' }}
        >
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: '#475569'
            }}
          />
        </div>
      );
    }
    
    // For 30 or fewer slides, show individual segments
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full h-full"
            style={{ 
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              className="flex-1 rounded-full h-full"
              style={{ 
                backgroundColor: '#CBD5E1'
              }}
            />
          );
        })}
      </>
    );
  };

  // ============================================
  // RENDER: QUIZ VIEW
  // ============================================
  
  const teamRoundType = session.mode === 'team-competition' ? (session.teamCompetitionData?.currentRoundType || 'normal') : 'normal';
  const isTeamSpecialRound = teamRoundType === 'power' || teamRoundType === 'double';
  const isCompetitionMode = session.mode === 'competition' || session.mode === 'team-competition' || session.mode === 'duel-competition' || session.mode === 'tactical-competition';

  return (
    <div className="flex flex-col h-screen relative" style={{ backgroundColor: '#F0F1F8' }}>
      {renderConnectionBanner()}

      {/* Special round overlay for team competition */}
      {isTeamSpecialRound && (
        <>
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: teamRoundType === 'power'
              ? 'linear-gradient(135deg, #7C3AED, #F59E0B, #7C3AED, #EC4899)'
              : 'linear-gradient(135deg, #F59E0B, #EF4444, #F59E0B, #FF6B00)',
            backgroundSize: '300% 300%',
            animation: 'specialGradientShift 3s ease infinite, specialPulseOpacity 2s ease-in-out infinite',
          }} />
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-2 px-5 py-2 rounded-full shadow-lg animate-pulse" style={{
              backgroundColor: teamRoundType === 'power' ? '#7C3AED' : '#F59E0B',
            }}>
              {teamRoundType === 'power' ? (
                <>
                  <span className="text-yellow-300 text-lg">⚡</span>
                  <span className="text-white font-bold text-sm">POWER KOLO — Všichni hrají!</span>
                  <span className="text-yellow-300 text-lg">⚡</span>
                </>
              ) : (
                <>
                  <span className="text-slate-900 font-black text-lg">x2</span>
                  <span className="text-slate-900 font-bold text-sm">Dvojité body!</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Duel competition VS banner */}
      {session.mode === 'duel-competition' && session.competitionPhase === 'question' && (() => {
        const dData = session.duelCompetitionData;
        const myDuelId = dData?.studentDuelMap?.[studentId || ''];
        const myDuel = myDuelId ? dData?.duels?.[myDuelId] : null;
        if (!myDuel) return null;
        const opponents = myDuel.playerIds.filter(pid => pid !== studentId);
        const opponentNames = opponents.map(pid => session.students?.[pid]?.name || '?');
        const myScore = myDuel.scores?.[studentId || ''] || 0;
        return (
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-2 px-5 py-2 rounded-full shadow-lg" style={{ backgroundColor: '#FF6B35' }}>
              <span className="text-white font-bold text-sm">{name}</span>
              <span className="text-white font-black text-lg">{myScore}</span>
              <span className="text-white/60 font-black">:</span>
              {opponents.map((pid, i) => (
                <React.Fragment key={pid}>
                  <span className="text-white font-black text-lg">{myDuel.scores?.[pid] || 0}</span>
                  <span className="text-white font-bold text-sm">{opponentNames[i]}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tactical competition top banner */}
      {session.mode === 'tactical-competition' && session.competitionPhase === 'question' && (() => {
        const tacData = session.tacticalCompetitionData;
        const myTacScore = tacData?.scores?.[studentId || ''] || 0;
        const myTacStreak = tacData?.streaks?.[studentId || ''] || 0;
        const myPU = tacData?.powerUps?.[studentId || ''] || {};
        const tacBlocked = tacData?.blockedPlayers?.[studentId || ''];
        const isPR = tacData?.isPowerRound;
        return (
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-2 pointer-events-none">
            <div className="flex items-center gap-3 px-5 py-2 rounded-full shadow-lg" style={{ backgroundColor: isPR ? '#F59E0B' : '#10B981' }}>
              {isPR && <span className="text-sm">⚡</span>}
              <span className="text-white font-bold text-sm">{name}</span>
              <span className="text-white font-black text-lg">{myTacScore}</span>
              {myTacStreak >= 3 && <span className="text-yellow-200 text-xs">🔥{myTacStreak}</span>}
              {myPU.shield && <span className="text-xs">🛡️</span>}
              {myPU.xray && <span className="text-xs">👁️</span>}
              {myPU.timeBoost && <span className="text-xs">⏰</span>}
              {tacBlocked && <span className="text-red-200 text-xs">🚫</span>}
            </div>
          </div>
        );
      })()}
      
      {/* Progress bar header - height 40px on desktop only (hidden in competition modes) */}
      {!isCompetitionMode && (
        <div 
          className="hidden lg:flex items-center justify-center px-4" 
          style={{ 
            backgroundColor: '#F0F1F8',
            height: 40,
          }}
        >
          {/* Progress bar - centered with max width */}
          <div className="flex items-center gap-1.5" style={{ width: '50%', maxWidth: '600px', height: '8px' }}>
            {renderProgressBar()}
          </div>
        </div>
      )}
      
      {/* Main content area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          minHeight: 0,
        }}
      >
        {/* Content with arrows - bottom padding 5px */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ minHeight: 0, paddingBottom: isMobile ? 16 : 5 }}>
          {/* Desktop: Left arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={goToPrevSlide}
                disabled={currentSlideIndex === 0}
                className={`w-12 h-12 rounded-full bg-[#CBD5E1] flex items-center justify-center text-slate-600 transition-all duration-300 ease-out ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:h-24'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Slide card - fills remaining space */}
          <div 
            ref={mobileScrollRef}
            className="flex-1 relative"
            style={{
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding - top for nav (smaller if locked mode), sides for shadow. No top padding in competition modes.
              padding: isMobile ? (isCompetitionMode ? '8px 8px 8px 8px' : (canNavigate ? '75px 8px 8px 8px' : '50px 8px 8px 8px')) : 16,
            }}
          >
            {/* Mobile: Fixed top navigation (hidden in competition modes) */}
            {isMobile && !isCompetitionMode && (
              <div 
                className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pb-2"
              >
                {/* Locked mode: only progress bar */}
                {!canNavigate ? (
                  <div 
                    className={`rounded-full px-6 py-3 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '150px' }}>
                      {renderProgressBar()}
                    </div>
                  </div>
                ) : (
                  /* Unlocked mode: buttons + progress bar */
                  <div 
                    className={`flex items-center gap-3 rounded-full px-4 py-2 transition-all duration-300 ${isScrolling ? 'bg-white shadow-lg' : ''}`}
                  >
                    <button
                      onClick={goToPrevSlide}
                      disabled={currentSlideIndex === 0}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''} bg-[#E2E8F0] text-slate-500`}
                    >
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-0.5" style={{ height: '8px', width: '120px' }}>
                      {renderProgressBar()}
                    </div>
                    <button
                      onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white'}`}
                      style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
                    >
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div 
              className={`
                w-full rounded-3xl overflow-hidden flex flex-col
                ${currentSlide?.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (currentSlide as ToolsSlide).certificateConfig?.customPdfUrl ? '' : 'bg-white shadow-md'}
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Mobile: min height to ensure background extends to viewport
                // Desktop: fill available space
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
              }}
              key={currentSlideIndex}
            >
              {/* Info slide with block layout - render ONLY BlockLayoutView */}
              {currentSlide.type === 'info' && (currentSlide as InfoSlide).layout && (currentSlide as InfoSlide).layout!.blocks.length > 0 ? (
                <div className="flex-1 flex flex-col" style={{ minHeight: isMobile ? '100%' : 0, height: '100%' }}>
                  <BlockLayoutView slide={currentSlide as InfoSlide} />
                </div>
              ) : (
                <>
                  {/* Question - only for activity slides (except those with their own display, and bubbles ABC which renders question inline) */}
                  {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'form' && currentSlide.activityType !== 'example' && !((currentSlide as any).activityType === 'abc' && ((currentSlide as any).answerType === 'bubbles' || (currentSlide as any).answerType === 'squares')) && (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                        <MathText>{(currentSlide as any).question || (currentSlide as any).title || 'Otázka'}</MathText>
                      </h1>
                      
                      {/* Question image */}
                      {(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' && (
                        <img 
                          src={(currentSlide as any).media.url} 
                          alt="Obrázek k otázce"
                          className="mt-4 max-w-full max-h-48 md:max-h-64 object-contain"
                        />
                      )}
                    </div>
                  )}
              
              {/* ABC Options */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'abc' && (
                <>
                  {((currentSlide as any).answerType === 'bubbles' || (currentSlide as any).answerType === 'squares') ? (
                    <div className={isMobile ? "flex flex-col h-full w-full" : "flex h-full w-full p-6 gap-6"}>
                      {/* Left/Top: Question + Image (identical to regular ABC) */}
                      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                        <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-[#4E5871] text-center leading-tight break-words max-w-full overflow-hidden">
                          <MathText>{(currentSlide as any).question || (currentSlide as any).title || ''}</MathText>
                        </h1>
                        {(currentSlide as any).media?.url && (currentSlide as any).media?.type === 'image' && (
                          <img 
                            src={(currentSlide as any).media.url} 
                            alt="Obrázek k otázce"
                            className="mt-4 max-w-full max-h-48 md:max-h-64 object-contain"
                          />
                        )}
                      </div>
                      {/* Right/Bottom: Bubbles + submit */}
                      <div
                        className="flex flex-col items-center justify-center"
                        style={{
                          flex: isMobile ? undefined : '0 0 45%',
                          padding: isMobile ? '4px 8px 20px' : 24,
                          gap: isMobile ? 12 : 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: isMobile ? 8 : 16,
                            width: '100%',
                            justifyItems: 'center',
                            overflow: 'visible',
                          }}
                        >
                        {(() => {
                          const isEvaluated = session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined);
                          const sr = (i: number, s: number) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
                          return (currentSlide as ABCActivitySlide).options.map((option, idx) => {
                            const bubbleColors = ['#93C5FD', '#7DD3FC', '#A5B4FC', '#BAE6FD', '#C7D2FE', '#E0F2FE'];
                            const color = bubbleColors[idx % bubbleColors.length];
                            const isSelected = selectedOption === option.id;
                            const wasSelected = currentResponse?.answer === option.id;
                            const isCorrectOption = option.isCorrect;
                            const isCorrect = isEvaluated && isCorrectOption;
                            const isWrong = isEvaluated && wasSelected && !isCorrectOption;
                            const optCount = (currentSlide as ABCActivitySlide).options.length;
                            const size = isMobile ? 130 : (optCount <= 3 ? 180 : 150);
                            const rot = (sr(idx, 1) - 0.5) * (isMobile ? 14 : 28);
                            const ox = (sr(idx, 2) - 0.5) * (isMobile ? 10 : 36);
                            const oy = (sr(idx, 3) - 0.5) * (isMobile ? 10 : 36);
                            const sj = 0.95 + sr(idx, 4) * 0.10;
                            const active = isSelected || wasSelected;
                            return (
                              <button
                                key={option.id}
                                onClick={() => !hasAnswered && !showResult && setSelectedOption(option.id)}
                                disabled={hasAnswered || showResult}
                                className="flex items-center justify-center font-bold transition-all"
                                style={{
                                  width: size, height: size,
                                  borderRadius: (currentSlide as any).answerType === 'squares' ? (isMobile ? 20 : 28) : '50%',
                                  backgroundColor: isCorrect ? '#10B981' : isWrong ? '#EF4444' : color,
                                  color: (isCorrect || isWrong) ? '#fff' : '#1e3a5f',
                                  fontSize: isMobile ? 18 : (size > 150 ? 26 : 22),
                                  border: (isSelected && !hasAnswered) ? '4px solid #1e40af' : isCorrect ? '4px solid #059669' : isWrong ? '4px solid #DC2626' : '4px solid transparent',
                                  boxShadow: active ? '0 6px 24px rgba(59,130,246,0.3)' : '0 3px 12px rgba(59,130,246,0.15)',
                                  transform: `translate(${ox}px, ${oy}px) rotate(${active ? 0 : rot}deg) scale(${active ? 1.1 : sj})`,
                                  lineHeight: 1.2, textAlign: 'center', padding: isMobile ? 10 : 12,
                                }}
                              >
                                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transform: (currentSlide as any).answerType === 'squares' ? undefined : `rotate(${active ? 0 : -rot}deg)` }}>
                                  <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, opacity: 0.5, letterSpacing: 1 }}>{String.fromCharCode(65 + idx)}</span>
                                  <MathText>{option.content || option.label}</MathText>
                                  {(isCorrect || isWrong) && <span style={{ fontSize: isMobile ? 18 : 22 }}>{isCorrect ? '✓' : '✗'}</span>}
                                </span>
                              </button>
                            );
                          });
                        })()}
                        </div>
                        {!hasAnswered && !showResult && (
                          <button
                            onClick={submitAnswer}
                            disabled={!selectedOption}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            style={{ backgroundColor: '#4F46E5', boxShadow: '0 6px 12px rgba(99,102,241,0.25)', fontSize: isMobile ? 15 : 18 }}
                          >
                            <Send className="w-4 h-4" />
                            Odpovědět
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
                    {(() => {
                      const isEvaluated = session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined);
                      const showCorrectness = isEvaluated;
                      
                      return (currentSlide as ABCActivitySlide).options.map((option) => {
                        const isSelected = selectedOption === option.id;
                        const isCorrectOption = option.isCorrect;
                        const wasSelected = currentResponse?.answer === option.id;
                        
                        return (
                          <button
                            key={option.id}
                            onClick={() => !hasAnswered && !showResult && setSelectedOption(option.id)}
                            disabled={hasAnswered || showResult}
                            className={`
                              relative p-3 lg:p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-3 lg:gap-4
                              ${showCorrectness && isCorrectOption ? 'bg-green-50 border-green-500' : ''}
                              ${showCorrectness && wasSelected && !isCorrectOption ? 'bg-red-50 border-red-500' : ''}
                              ${!showCorrectness && (hasAnswered || showResult) && wasSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                              ${!showCorrectness && !hasAnswered && !showResult && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
                              ${!showCorrectness && !hasAnswered && !showResult && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
                              ${!showCorrectness && (hasAnswered || showResult) && !wasSelected ? 'bg-white border-slate-100 opacity-50' : ''}
                              ${showCorrectness && !isCorrectOption && !wasSelected ? 'bg-white border-slate-100 opacity-50' : ''}
                            `}
                          >
                            <span 
                              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-bold text-base lg:text-lg flex-shrink-0 transition-colors"
                              style={{
                                backgroundColor: showCorrectness && isCorrectOption ? '#bbf7d0' 
                                  : showCorrectness && wasSelected && !isCorrectOption ? '#fecaca'
                                  : (hasAnswered || showResult || isSelected) && wasSelected ? '#c7d2fe'
                                  : !hasAnswered && !showResult && isSelected ? '#c7d2fe' 
                                  : '#E2E8F0',
                                color: showCorrectness && isCorrectOption ? '#166534' 
                                  : showCorrectness && wasSelected && !isCorrectOption ? '#991b1b'
                                  : (hasAnswered || showResult || isSelected) && wasSelected ? '#3730a3'
                                  : !hasAnswered && !showResult && isSelected ? '#3730a3' 
                                  : '#475569',
                              }}
                            >
                              {option.label || option.id?.toUpperCase() || '?'}
                            </span>
                            <span className="text-base sm:text-lg lg:text-xl font-medium text-[#4E5871] flex-1 break-words overflow-hidden">
                              <MathText>{option.content || ''}</MathText>
                            </span>
                            
                            {showCorrectness && isCorrectOption && (
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            )}
                            {hasAnswered && !showCorrectness && wasSelected && (
                              <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-600 font-medium">Odesláno</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  )}
                  
                  {/* Show explanation/hint for ABC after answer is evaluated */}
                  {session?.settings?.showSolutionHints && hasAnswered && (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined) && (currentSlide as ABCActivitySlide).explanation && (
                    <div className="mt-4 mx-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as ABCActivitySlide).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Example activity - shared component */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'example' && (
                <ExampleActivityView
                  slide={currentSlide as ExampleActivitySlide}
                  textAnswer={textAnswer}
                  setTextAnswer={setTextAnswer}
                  hasAnswered={hasAnswered}
                  response={currentResponse}
                  showResults={currentResponse?.isCorrect !== undefined && currentResponse?.isCorrect !== null}
                  showExplanation={!!session?.settings?.showSolutionHints}
                  onSubmit={submitAnswer}
                  customKeys={quiz?.settings?.customKeys}
                  extraKeys={quiz?.settings?.extraKeys}
                />
              )}

              {/* Open question (separate from example) */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'open' && (
                <div className="w-full max-w-2xl mx-auto px-6">
                  {(() => {
                    const isEvaluated = session?.showResults === true || (currentResponse?.isCorrect !== null && currentResponse?.isCorrect !== undefined);
                    return (
                      <div className="relative">
                        <input
                          type="text"
                          value={hasAnswered ? (currentResponse?.answer as string) : textAnswer}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          disabled={hasAnswered || showResult}
                          placeholder="Napište svou odpověď..."
                          className={`
                            w-full px-6 py-4 rounded-2xl border-2 text-xl text-center outline-none transition-all
                            ${isEvaluated
                              ? currentResponse?.isCorrect 
                                ? 'bg-green-50 border-green-500' 
                                : 'bg-red-50 border-red-500'
                              : hasAnswered
                                ? 'bg-indigo-50 border-indigo-500'
                                : 'border-slate-200 focus:border-indigo-400 focus:ring-0'
                            }
                          `}
                        />
                        {hasAnswered && !isEvaluated && (
                          <p className="text-center text-sm text-indigo-600 mt-2 font-medium">✓ Odpověď odeslána, čekám na vyhodnocení</p>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Only show result after teacher evaluation */}
                  {currentResponse?.isCorrect !== undefined && currentResponse?.isCorrect !== null && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {currentResponse.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-green-600 font-medium">Správně!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-red-600">
                            Správně: <MathText>
                              {(currentSlide as OpenActivitySlide).correctAnswers?.[0] || ''}
                            </MathText>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Show explanation/hint after answer is evaluated */}
                  {session?.settings?.showSolutionHints && hasAnswered && currentResponse?.isCorrect !== undefined && (currentSlide as any).explanation && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                        <HelpCircle className="w-5 h-5" />
                        <span>Vysvětlení:</span>
                      </div>
                      <p className="text-slate-700">
                        <MathText>{(currentSlide as any).explanation || ''}</MathText>
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Board activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'board' && (
                <div className="flex-1 overflow-hidden">
                  <BoardSlideView 
                    slide={currentSlide as BoardActivitySlide}
                    posts={boardPosts.posts}
                    currentUserId={studentId || undefined}
                    currentUserName={name || undefined}
                    isTeacher={false}
                    onAddPost={boardPosts.addPost}
                    onLikePost={boardPosts.likePost}
                    onDeletePost={boardPosts.deletePost}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Voting activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'voting' && (
                <div className="flex-1 overflow-hidden">
                  <VotingSlideView 
                    slide={currentSlide as VotingActivitySlide}
                    isTeacher={false}
                    hasVoted={voting.hasVoted}
                    myVote={voting.myVote}
                    voteCounts={voting.getVoteCounts()}
                    totalVoters={voting.getTotalVotes()}
                    onVote={voting.vote}
                    readOnly={false}
                  />
                </div>
              )}
              
              {/* Connect Pairs activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'connect-pairs' && (
                <div className="flex-1 overflow-hidden">
                  <ConnectPairsView 
                    slide={currentSlide as ConnectPairsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Fill Blanks activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'fill-blanks' && (
                <div className="flex-1 overflow-hidden">
                  <FillBlanksView 
                    slide={currentSlide as FillBlanksActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Image Hotspots activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'image-hotspots' && (
                <div className="flex-1 overflow-hidden">
                  <ImageHotspotsView 
                    slide={currentSlide as ImageHotspotsActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Video Quiz activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'video-quiz' && (
                <div className="flex-1 overflow-hidden">
                  <VideoQuizView 
                    slide={currentSlide as VideoQuizActivitySlide}
                    isTeacher={false}
                    readOnly={false}
                    onSubmit={(result) => {
                      // Save answer and navigate
                      submitAnswer();
                    }}
                  />
                </div>
              )}
              
              {/* Form activity */}
              {currentSlide.type === 'activity' && currentSlide.activityType === 'form' && (
                <div className="flex-1 overflow-y-auto">
                  <FormView 
                    slide={currentSlide as any}
                    answer={formAnswer}
                    onAnswerChange={(answer) => {
                      setFormAnswer(answer);
                      setTextAnswer(JSON.stringify(answer));
                    }}
                    isReadOnly={false}
                  />
                </div>
              )}

              {/* Tools slide - Certificate */}
              {currentSlide.type === 'tools' && (currentSlide as ToolsSlide).toolType === 'certificate' && (
                <div className="flex-1 overflow-y-auto">
                  <CertificateView 
                    slide={currentSlide as ToolsSlide}
                    quiz={quiz}
                    formResponses={collectFormResponses()}
                    isPreview={false}
                  />
                </div>
              )}
              
              {/* Legacy info slide (without block layout) */}
              {currentSlide.type === 'info' && (!(currentSlide as InfoSlide).layout || (currentSlide as InfoSlide).layout!.blocks.length === 0) && (
                <div className="flex-1 flex items-center justify-center p-8">
                  {(currentSlide as any).content && (
                    <div 
                      className="prose prose-lg max-w-3xl text-center text-slate-600"
                      dangerouslySetInnerHTML={{ __html: (currentSlide as any).content }}
                    />
                  )}
                </div>
              )}
              
              {/* Submit button or waiting indicator - only for activity slides (except those with their own buttons) */}
              {currentSlide.type === 'activity' && currentSlide.activityType !== 'board' && currentSlide.activityType !== 'voting' && currentSlide.activityType !== 'connect-pairs' && currentSlide.activityType !== 'fill-blanks' && currentSlide.activityType !== 'image-hotspots' && currentSlide.activityType !== 'video-quiz' && currentSlide.activityType !== 'example' && !((currentSlide as any).activityType === 'abc' && ((currentSlide as any).answerType === 'bubbles' || (currentSlide as any).answerType === 'squares')) && (
              <div className="flex justify-center py-6 md:py-10">
                {!hasAnswered && !showResult && currentSlide.type === 'activity' ? (
                  <button
                    ref={answerButtonRef}
                    onClick={submitAnswer}
                    disabled={
                      (currentSlide.activityType === 'abc' && !selectedOption) ||
                      (currentSlide.activityType === 'open' && !textAnswer.trim()) ||
                      (currentSlide.activityType === 'example' && !textAnswer.trim()) ||
                      // Form: disabled if required fields are not filled
                      (currentSlide.activityType === 'form' && 
                        ((currentSlide as any).fields || []).some((field: any) => 
                          field.required && (
                            !formAnswer[field.id] || 
                            (Array.isArray(formAnswer[field.id]) && (formAnswer[field.id] as string[]).length === 0) ||
                            (typeof formAnswer[field.id] === 'string' && !(formAnswer[field.id] as string).trim())
                          )
                        )
                      )
                    }
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${showWiggle ? 'animate-wiggle' : ''}`}
                    style={{ 
                      backgroundColor: '#4F46E5', 
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
                    }}
                  >
                    <Send className="w-5 h-5" />
                    {currentSlide.activityType === 'form' ? 'Odeslat formulář' : 'Odpovědět'}
                  </button>
                ) : canNavigate ? (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <ArrowRight className="w-5 h-5" />
                    <span>Použij šipky pro další otázku</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Čekám na další otázku...</span>
                  </div>
                )}
              </div>
              )}
              </>
              )}
            </div>
            
            {/* Mobile: Extra space at bottom for scrolling */}
            {isMobile && (
              <div style={{ height: '120px', flexShrink: 0 }} />
            )}
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            {canNavigate && (
              <button
                onClick={() => (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? goToNextSlide() : (!canProceed ? triggerWiggle() : null)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${(currentSlideIndex === quiz.slides.length - 1 || !canProceed) ? 'bg-slate-300 text-slate-400' : 'text-white hover:h-24'}`}
                style={{ backgroundColor: (currentSlideIndex < quiz.slides.length - 1 && canProceed) ? '#7C3AED' : undefined }}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default QuizJoinPage;
