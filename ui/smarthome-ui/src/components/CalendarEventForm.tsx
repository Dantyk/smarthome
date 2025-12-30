'use client';
import { useState } from 'react';

interface CalendarEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CalendarEventForm({ onSuccess, onCancel }: CalendarEventFormProps) {
  const [summary, setSummary] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:1880/api/calendar/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          start,
          end,
          description,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Udalosť vytvorená!');
        setSummary('');
        setStart('');
        setEnd('');
        setDescription('');
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || 'Chyba pri vytváraní udalosti');
      }
    } catch (err) {
      setError('Chyba spojenia so serverom');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (mode: string) => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60000); // +5 min
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60000); // +2h
    
    setSummary(`SMH MODE=${mode}`);
    setStart(startTime.toISOString().slice(0, 16));
    setEnd(endTime.toISOString().slice(0, 16));
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-bold mb-4">Nová kalendárová udalosť</h3>
      
      {/* Quick fill buttons */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => quickFill('doma')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          MODE=doma
        </button>
        <button
          type="button"
          onClick={() => quickFill('vikend')}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
        >
          MODE=vikend
        </button>
        <button
          type="button"
          onClick={() => quickFill('pracovny_den')}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          MODE=pracovny_den
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Názov udalosti *</label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="SMH MODE=doma"
            required
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Použite SMH MODE=xxx, SMH BOOST room=xxx temp=xx, alebo SMH OFFSET room=xxx +/-x
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Začiatok *</label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Koniec *</label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Poznámka (voliteľné)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dodatočná poznámka..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-900/30 p-2 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-500 text-sm bg-green-900/30 p-2 rounded">
            {success}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
          >
            {loading ? 'Vytváranie...' : 'Vytvoriť udalosť'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
            >
              Zrušiť
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
