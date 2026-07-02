import { fireEvent, render, screen } from 'src/test-utils';

import ModuleStep from '../module-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

describe('ModuleStep', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders the step title and the three module cards', () => {
    render(<ModuleStep onSelect={jest.fn()} />);

    expect(screen.getByText('testing.steps.module')).toBeInTheDocument();
    expect(screen.getByText('common.modules.specialty')).toBeInTheDocument();
    expect(screen.getByText('common.modules.techSafety')).toBeInTheDocument();
    expect(screen.getByText('common.modules.industrialSafety')).toBeInTheDocument();
    expect(screen.getByText('testing.modules.specialtyHint')).toBeInTheDocument();
    expect(screen.getByText('testing.modules.techSafetyHint')).toBeInTheDocument();
    expect(screen.getByText('testing.modules.industrialSafetyHint')).toBeInTheDocument();
  });

  it('fires onSelect with the specialty module', () => {
    const onSelect = jest.fn();
    render(<ModuleStep onSelect={onSelect} />);

    fireEvent.click(screen.getByText('common.modules.specialty'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('specialty');
  });

  it('fires onSelect with the tech_safety module', () => {
    const onSelect = jest.fn();
    render(<ModuleStep onSelect={onSelect} />);

    fireEvent.click(screen.getByText('common.modules.techSafety'));

    expect(onSelect).toHaveBeenCalledWith('tech_safety');
  });

  it('fires onSelect with the industrial_safety module', () => {
    const onSelect = jest.fn();
    render(<ModuleStep onSelect={onSelect} />);

    fireEvent.click(screen.getByText('common.modules.industrialSafety'));

    expect(onSelect).toHaveBeenCalledWith('industrial_safety');
  });
});
