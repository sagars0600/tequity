import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const rootEl = document.getElementById('root') as HTMLElement;

startApp();

function startApp() {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

reportWebVitals();


// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import './index.css';
// import App from './App';
// import reportWebVitals from './reportWebVitals';

// const rootEl = document.getElementById('root') as HTMLElement;
// if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
//   import('react-axe').then((axe) => {
//     axe.default(React, ReactDOM, 1000);
//     startApp(); 
//   });
// } else {
//   startApp();
// }

// function startApp() {
//   const root = ReactDOM.createRoot(rootEl);
//   root.render(
//     <React.StrictMode>
//       <App />
//     </React.StrictMode>,
//   );
// }

// reportWebVitals();
