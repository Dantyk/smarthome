/**
 * Unit tests for logger
 */

import { logger } from '../../../ui/smarthome-ui/src/lib/logger';

describe('Logger', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log info messages with correct structure', () => {
    logger.info('Test message', { room: 'obyvacka' });
    
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
    
    expect(loggedData).toMatchObject({
      level: 'info',
      message: 'Test message',
      room: 'obyvacka',
    });
    expect(loggedData.timestamp).toBeDefined();
  });

  it('should log warnings', () => {
    logger.warn('Warning message');
    
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
    
    expect(loggedData.level).toBe('warn');
    expect(loggedData.message).toBe('Warning message');
  });

  it('should log errors with trace_id', () => {
    logger.error('Error occurred', { trace_id: 'test-123' });
    
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    
    expect(loggedData).toMatchObject({
      level: 'error',
      message: 'Error occurred',
      trace_id: 'test-123',
    });
  });
});
