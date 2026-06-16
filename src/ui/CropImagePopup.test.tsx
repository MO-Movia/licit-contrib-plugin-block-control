import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { centerCrop, makeAspectCrop } from 'react-image-crop';
import { CropImagePopup } from './CropImagePopup';

jest.mock('react-image-crop', () => {
  const ReactCrop = ({
    children,
    onChange,
    onComplete,
  }: {
    children: React.ReactNode;
    onChange: (crop: unknown) => void;
    onComplete: (crop: unknown) => void;
  }) => (
    <div
      data-testid="react-crop"
      onMouseDown={() => {
        const updatedCrop = { unit: 'px', x: 7, y: 8, width: 90, height: 60 };
        onChange(updatedCrop);
        onComplete(updatedCrop);
      }}
    >
      {children}
    </div>
  );

  return {
    __esModule: true,
    centerCrop: jest.fn((crop) => ({ ...crop, x: 10, y: 12, height: 75 })),
    default: ReactCrop,
    makeAspectCrop: jest.fn((crop) => ({ ...crop, height: 120 })),
  };
});

describe('CropImagePopup', () => {
  const testSrc = 'https://example.com/test.jpg';

  let drawImage: jest.Mock;
  let getContext: jest.Mock;
  let toDataURL: jest.Mock;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    drawImage = jest.fn();
    getContext = jest.fn(() => ({ drawImage }));
    toDataURL = jest.fn(() => 'data:image/png;base64,cropped');
    originalCreateElement = document.createElement.bind(document);

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'canvas') {
        Object.assign(element, {
          getContext,
          toDataURL,
        });
      }
      return element;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the crop image and buttons', () => {
    render(<CropImagePopup onCancel={jest.fn()} onConfirm={jest.fn()} src={testSrc} />);

    expect(screen.getByAltText('Crop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeInTheDocument();
  });

  it('calls onCancel from the cancel button', () => {
    const onCancel = jest.fn();

    render(<CropImagePopup onCancel={onCancel} onConfirm={jest.fn()} src={testSrc} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm if crop is invalid', () => {
    const onConfirmMock = jest.fn();

    render(<CropImagePopup onCancel={jest.fn()} onConfirm={onConfirmMock} src={testSrc} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));

    expect(onConfirmMock).not.toHaveBeenCalled();
  });

  it('centers the initial crop on image load', () => {
    render(
      <CropImagePopup
        defaultUnit="%"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        src={testSrc}
      />
    );

    const image = screen.getByAltText('Crop');
    Object.defineProperty(image, 'width', { configurable: true, value: 500 });
    Object.defineProperty(image, 'height', { configurable: true, value: 300 });

    fireEvent.load(image);

    expect(makeAspectCrop).toHaveBeenCalledWith({ unit: 'px', width: 400 }, 4 / 3, 500, 300);
    expect(centerCrop).toHaveBeenCalled();
  });

  it('confirms crop data with a generated canvas image', () => {
    const onConfirm = jest.fn();

    render(<CropImagePopup onCancel={jest.fn()} onConfirm={onConfirm} src={testSrc} />);

    const image = screen.getByAltText('Crop');
    Object.defineProperty(image, 'width', { configurable: true, value: 200 });
    Object.defineProperty(image, 'height', { configurable: true, value: 100 });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 400 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 200 });

    fireEvent.mouseDown(screen.getByTestId('react-crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));

    expect(drawImage).toHaveBeenCalledWith(image, 14, 16, 180, 120, 0, 0, 90, 60);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(onConfirm).toHaveBeenCalledWith({
      croppedBase64: 'data:image/png;base64,cropped',
      height: 60,
      left: 7,
      top: 8,
      width: 90,
    });
  });

  it('does not confirm when the canvas context cannot be created', () => {
    const onConfirm = jest.fn();
    getContext.mockReturnValueOnce(null);

    render(<CropImagePopup onCancel={jest.fn()} onConfirm={onConfirm} src={testSrc} />);

    fireEvent.mouseDown(screen.getByTestId('react-crop'));
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
