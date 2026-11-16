import React, { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { messageService } from '#services/MessageService';
import { useLocalization } from '#localization/LocalizationContext';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface RecordAccessAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
}

const RecordAccessAnalysisDialog: React.FC<RecordAccessAnalysisDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useLocalization();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setInputValue('');
      setOptions([]);
      setSelectedUsers([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const query = inputValue.trim();
    if (query.length < 2) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await messageService.sendMessage('admin:search-users', { query });
        if (!response.success) {
          throw new Error(response.error || t('securitySearchFailed'));
        }
        const data = response.data as { data?: { users?: Array<Record<string, string>> } };
        if (!cancelled) {
          setOptions(
            (data.data?.users ?? []).map(user => ({
              id: user.systemuserid,
              name: user.fullname,
              email: user.internalemailaddress,
            }))
          );
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : t('securitySearchFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [inputValue, t]);

  const analyze = async () => {
    if (!selectedUsers.length) {
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await messageService.sendMessage('form:analyze-record-access', {
        userId: selectedUsers[0].id,
        userName: selectedUsers[0].name,
        comparisonUser: selectedUsers[1]
          ? { userId: selectedUsers[1].id, userName: selectedUsers[1].name }
          : undefined,
      });
      const result = response.data as { success?: boolean; error?: string } | undefined;
      if (!response.success || result?.success === false) {
        throw new Error(result?.error || response.error || t('securityAnalysisFailed'));
      }
      onClose();
    } catch (analysisError) {
      setError(
        analysisError instanceof Error ? analysisError.message : t('securityAnalysisFailed')
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>{t('securityAccessAnalysis')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          {t('securityAccessComparisonHelp')}
        </Typography>
        <Autocomplete
          multiple
          options={options}
          value={selectedUsers}
          inputValue={inputValue}
          onChange={(_, value) => {
            if (value.length <= 2) {
              setSelectedUsers(value);
            }
          }}
          onInputChange={(_, value) => setInputValue(value)}
          getOptionLabel={option => option.name}
          getOptionDisabled={option =>
            selectedUsers.length >= 2 && !selectedUsers.some(user => user.id === option.id)
          }
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option.id} label={option.name} />
            ))
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterOptions={items => items}
          clearText={t('securityClearSelection')}
          openText={t('securityOpenOptions')}
          closeText={t('securityCloseOptions')}
          loading={isSearching}
          loadingText={t('securitySearching')}
          noOptionsText={t('securityNoResults')}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box>
                <Typography variant='body2'>{option.name}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {option.email}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              label={t('securitySearchUsers')}
              placeholder={t('securitySearchMinimum')}
              helperText={t('securityAccessOperationsHelp')}
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isSearching ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        {error && (
          <Alert severity='error' sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close')}</Button>
        <Button
          variant='contained'
          disabled={!selectedUsers.length || isAnalyzing}
          onClick={analyze}
        >
          {t(isAnalyzing ? 'securityAnalyzing' : 'securityAnalyze')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordAccessAnalysisDialog;
