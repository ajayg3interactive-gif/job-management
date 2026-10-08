import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { setupStore } from '../app/store';

// Renders the real app with a fresh store and an in-memory router.
export function renderApp(route = '/') {
  const store = setupStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  return store;
}
