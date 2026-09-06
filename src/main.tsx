import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installFormValidationFeedback } from './utils/formValidationFeedback';

// One listener covering every form: brings a field the browser rejected into
// view, so a blocked submit never looks like a dead button.
installFormValidationFeedback();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
