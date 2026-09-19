import React, { useState, useMemo } from 'react';
import { Play, Eraser, Calculator, Database } from 'lucide-react';
import { Card, Button, Badge, Alert, Select, Spinner } from '../../components/ui';
import FilterField from './FilterField.jsx';
import { cleanFilters, countFilters, fmtCount } from './exportMeta.js';
import { previewExport, createExport } from '../../api/opsApi.js';

// ─── Naya export maangne wali screen ────────────────────────────────────────
//
// Filters backend ke catalog se aate hain, isliye yahan koi filter hardcoded
// nahi hai. Groups ke hisaab se sections bante hain — Identity, Location,
// Vehicle, KYC… — wahi order jo backend bhejta hai.

export default function NewExportTab({ catalog, onQueued, onError }) {
  const datasets = catalog?.datasets || [];
  const cityGroups = catalog?.cityGroups || [];

  const [datasetKey, setDatasetKey] = useState(datasets[0]?.key || '');
  const [draft, setDraft]   = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy]     = useState('');

  const dataset = useMemo(
    () => datasets.find(d => d.key === datasetKey) || null,
    [datasets, datasetKey],
  );

  const applied = countFilters(draft);

  // Dataset badla to filters reset — ek dataset ke filter doosre pe lagte hi
  // nahi, aur backend unhe unknown bol ke 400 dega.
  const switchDataset = (key) => {
    setDatasetKey(key);
    setDraft({});
    setPreview(null);
  };

  const setFilter = (key, value) => {
    setDraft(d => ({ ...d, [key]: value }));
    // Filter badalte hi purana count jhoot ban jaata hai.
    setPreview(null);
  };

  const runPreview = async () => {
    setBusy('preview');
    try {
      const res = await previewExport(datasetKey, cleanFilters(draft));
      setPreview(res.data?.data || null);
    } catch (err) {
      onError(err.response?.data?.message || 'Could not count the rows');
    } finally {
      setBusy('');
    }
  };

  const submit = async () => {
    setBusy('create');
    try {
      const res = await createExport(datasetKey, cleanFilters(draft));
      onQueued(res.data?.message || 'Export queued', res.data?.data);
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not queue the export');
    } finally {
      setBusy('');
    }
  };

  if (!datasets.length) {
    return <Alert tone="danger">No datasets available. The catalog did not load.</Alert>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <Select
          label="What to export"
          value={datasetKey}
          onChange={switchDataset}
          options={datasets.map(d => ({ value: d.key, label: d.label }))}
          className="w-64"
        />
        {dataset && (
          <div className="flex items-center gap-2 pb-1">
            <Badge tone="neutral" icon={Database}>{dataset.columnCount} columns</Badge>
            <Badge tone="neutral">{dataset.filterCount} filters available</Badge>
            {applied > 0 && <Badge tone="brand">{applied} applied</Badge>}
          </div>
        )}
      </div>

      {dataset?.description && (
        <p className="text-xs text-ink-muted leading-relaxed">{dataset.description}</p>
      )}

      {/* Filter groups — backend ka order hi rakha gaya hai */}
      {dataset?.filterGroups?.map(group => (
        <Card key={group.label} className="space-y-3">
          <h4 className="text-xs font-bold text-accent-navy uppercase tracking-wider">
            {group.label}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.filters.map(f => (
              <FilterField
                key={f.key}
                spec={f}
                value={draft[f.key]}
                onChange={setFilter}
                cityGroups={cityGroups}
              />
            ))}
          </div>
        </Card>
      ))}

      {/* Action bar */}
      <Card className="sticky bottom-3 shadow-pop">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            {preview ? (
              <p className="text-sm">
                <strong className="text-accent-navy tabular-nums">{fmtCount(preview.rowCount)}</strong>
                <span className="text-ink-muted"> rows match</span>
                {preview.rowCount === 0 && (
                  <span className="text-red-600"> — nothing to export</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                {applied === 0
                  ? 'No filters — this exports the whole dataset.'
                  : `${applied} filter${applied === 1 ? '' : 's'} applied. Count the rows before exporting.`}
              </p>
            )}
            {preview?.filterSummary?.length > 0 && (
              <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">
                {preview.filterSummary.join(' · ')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {applied > 0 && (
              <Button variant="ghost" size="sm" icon={Eraser}
                      onClick={() => { setDraft({}); setPreview(null); }}>
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" icon={Calculator}
                    loading={busy === 'preview'} onClick={runPreview}>
              Count rows
            </Button>
            <Button variant="primary" size="sm" icon={Play}
                    loading={busy === 'create'}
                    disabled={preview?.rowCount === 0}
                    onClick={submit}>
              Build Excel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
