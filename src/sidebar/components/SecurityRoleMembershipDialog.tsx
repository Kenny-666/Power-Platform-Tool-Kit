import React, { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { messageService } from '#services/MessageService';
import { useLocalization } from '#localization/LocalizationContext';

type LookupMode = 'users-to-roles' | 'roles-to-users';

interface LookupOption {
  id: string;
  label: string;
  detail?: string;
}

interface SecurityRoleMembershipDialogProps {
  mode: LookupMode | null;
  onClose: () => void;
}

const SecurityRoleMembershipDialog: React.FC<SecurityRoleMembershipDialogProps> = ({
  mode,
  onClose,
}) => {
  const { t } = useLocalization();
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selected, setSelected] = useState<LookupOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUserLookup = mode === 'users-to-roles';
  const title = t(isUserLookup ? 'securityBulkUserRoles' : 'securityBulkRoleUsers');
  const inputLabel = t(isUserLookup ? 'securitySelectUsers' : 'securitySelectRoles');

  useEffect(() => {
    setInputValue('');
    setOptions([]);
    setSelected([]);
    setError(null);
  }, [mode]);

  useEffect(() => {
    const query = inputValue.trim();
    if (!mode || query.length < 2) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const response = await messageService.sendMessage(
          isUserLookup ? 'admin:search-users' : 'admin:search-security-roles',
          { query }
        );
        if (!response.success) {
          throw new Error(response.error || t('securitySearchFailed'));
        }

        if (!cancelled) {
          if (isUserLookup) {
            const data = response.data as { data?: { users?: Array<Record<string, string>> } };
            setOptions(
              (data.data?.users ?? []).map(user => ({
                id: user.systemuserid,
                label: user.fullname,
                detail: user.internalemailaddress,
              }))
            );
          } else {
            const data = response.data as { data?: Array<Record<string, string>> };
            setOptions(
              (data.data ?? []).map(role => ({
                id: role.roleid,
                label: role.name,
                detail: role.businessUnitName,
              }))
            );
          }
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
  }, [inputValue, isUserLookup, mode, t]);

  const handleViewMemberships = async () => {
    if (!mode || selected.length === 0) {
      setError(t('securitySelectionRequired'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await messageService.sendMessage('admin:get-security-role-memberships', {
        mode,
        ids: selected.map(option => option.id),
      });
      const result = response.data as { success?: boolean; error?: string } | undefined;
      if (!response.success || result?.success === false) {
        throw new Error(result?.error || response.error || t('securityMembershipFailed'));
      }

      onClose();
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : t('securityMembershipFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={mode !== null} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          {t(isUserLookup ? 'securityUserRolesHelp' : 'securityRoleUsersHelp')}
        </Typography>
        <Autocomplete
          multiple
          options={options}
          value={selected}
          inputValue={inputValue}
          onChange={(_, value) => setSelected(value)}
          onInputChange={(_, value) => setInputValue(value)}
          getOptionLabel={option => option.label}
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
                <Typography variant='body2'>{option.label}</Typography>
                {option.detail && (
                  <Typography variant='caption' color='text.secondary'>
                    {isUserLookup
                      ? option.detail
                      : t('securityBusinessUnit', { name: option.detail })}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              label={inputLabel}
              placeholder={t('securitySearchMinimum')}
              helperText={t('securityMultiSelectHelp')}
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
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option.id} label={option.label} />
            ))
          }
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
          onClick={handleViewMemberships}
          disabled={isLoading || selected.length === 0}
        >
          {t(isLoading ? 'securityLoading' : 'securityViewRelationships')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SecurityRoleMembershipDialog;
