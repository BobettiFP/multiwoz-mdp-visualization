# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

# MultiWOZ 그래프 시각화 프로젝트 설정 가이드

이 가이드는 Python 백엔드와 React 프론트엔드를 연결하여 MultiWOZ 대화 시스템의 상태-행동 공간을 시각화하는 방법을 안내합니다.

## 1. 프로젝트 구조

프로젝트는 다음과 같은 구조로 구성됩니다:

```
multiwoz-mdp-visualization/
├── backend/                  # Python Flask 백엔드
│   ├── app.py                # 메인 Flask 애플리케이션
│   └── requirements.txt      # 필요한 Python 패키지
│
└── frontend/                 # React 프론트엔드
    ├── public/
    └── src/
        ├── components/
        │   ├── MultiWOZGraph.jsx      # 그래프 컴포넌트
        │   └── MultiWOZGraph.css      # 스타일시트
        ├── App.js
        └── index.js
```

## 2. 백엔드 설정

1. 디렉토리 생성 및 가상 환경 설정:

```bash
mkdir -p multiwoz-mdp-visualization/backend
cd multiwoz-mdp-visualization/backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows의 경우: venv\Scripts\activate
```

2. 필요한 패키지 설치:

```bash
pip install flask flask-cors networkx matplotlib
```

3. `requirements.txt` 파일 생성:

```bash
pip freeze > requirements.txt
```

4. `app.py` 파일 생성:
   - 이전에 제공한 Python 백엔드 코드를 app.py 파일에 붙여넣기

5. 서버 실행:

```bash
python app.py
```

백엔드 서버가 http://localhost:5000 에서 실행됩니다.

## 3. 프론트엔드 설정

1. React 앱 생성:

```bash
npx create-react-app multiwoz-mdp-visualization/frontend
cd multiwoz-mdp-visualization/frontend
```

2. 필요한 패키지 설치:

```bash
npm install d3
```

3. 컴포넌트 파일 생성:

```bash
mkdir -p src/components
```

4. `src/components/MultiWOZGraph.jsx` 파일 생성:
   - 이전에 제공한 React 컴포넌트 코드를 이 파일에 붙여넣기

5. `src/components/MultiWOZGraph.css` 파일 생성:
   - 이전에 제공한 CSS 코드를 이 파일에 붙여넣기

6. `src/App.js` 수정:

```jsx
import React from 'react';
import './App.css';
import MultiWOZGraph from './components/MultiWOZGraph';

function App() {
  return (
    <div className="App">
      <MultiWOZGraph />
    </div>
  );
}

export default App;
```

7. 개발 서버 실행:

```bash
npm start
```

React 개발 서버가 http://localhost:3000 에서 실행됩니다.

## 4. 전체 플로우 실행

1. 두 개의 터미널 창을 엽니다.

2. 첫 번째 터미널에서 백엔드 서버 실행:
```bash
cd multiwoz-mdp-visualization/backend
source venv/bin/activate  # Windows의 경우: venv\Scripts\activate
python app.py
```

3. 두 번째 터미널에서 프론트엔드 개발 서버 실행:
```bash
cd multiwoz-mdp-visualization/frontend
npm start
```

4. 브라우저를 열고 http://localhost:3000 으로 접속하면 MultiWOZ 상태-행동 그래프를 볼 수 있습니다.

## 5. 기능

- **도메인 선택**: 드롭다운 메뉴를 통해 호텔, 레스토랑, 기차 등 특정 도메인이나 전체 도메인을 선택할 수 있습니다.
- **인터랙티브 그래프**: 
  - 노드 드래그: 노드를 클릭하고 드래그하여 위치 이동
  - 확대/축소: 마우스 휠을 사용하여 그래프 확대/축소
  - 툴팁: 노드에 마우스를 올리면 상세 정보 표시
- **색상 구분**:
  - 상태 노드: 사각형으로 표시
  - 행동 노드: 둥근 모양으로 표시
  - 시작/종료/결과 없음/예약 완료 등 다양한 상태를 색상으로 구분

## 6. 문제 해결

- **CORS 오류**: Flask 서버에서 CORS 설정이 제대로 되어 있는지 확인하세요.
- **그래프가 표시되지 않음**: 브라우저 콘솔을 확인하여 오류 메시지를 확인하세요.
- **백엔드 연결 실패**: 프론트엔드에서는 백엔드 연결 실패 시 더미 데이터를 사용하도록 설정되어 있습니다.

## 7. 확장 가능성

- **실제 대화 데이터 통합**: MultiWOZ 데이터셋의 실제 대화를 로드하여 그래프에 표시
- **강화학습 시각화**: 학습된 정책에 따른 경로 하이라이트 기능 추가
- **대화 시뮬레이션**: 그래프 위에서 시뮬레이션된 대화 경로를 실시간으로 시각화