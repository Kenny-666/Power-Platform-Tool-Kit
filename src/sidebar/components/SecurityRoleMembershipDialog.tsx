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
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [selected, setSelected] = useState<LookupOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUserLookup = mode === 'users-to-roles';
  const title = isUserLookup ? '批量用户查角色' : '批量角色查用户';
  const inputLabel = isUserLookup ? '搜索并选择用户' : '搜索并选择安全角色';

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
          throw new Error(response.error || 'Search failed.');
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
                detail: role.businessUnitName ? `业务部门：${role.businessUnitName}` : undefined,
              }))
            );
          }
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : 'Search failed.');
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
  }, [inputValue, isUserLookup, mode]);

  const handleViewMemberships = async () => {
    if (!mode || selected.length === 0) {
      setError(`请至少选择一个${isUserLookup ? '用户' : '安全角色'}。`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await messageService.sendMessage('admin:get-security-role-memberships', {
        mode,
        ids: selected.map(option => option.id),
      });
      if (!response.success) {
        throw new Error(response.error || 'Unable to retrieve memberships.');
      }

      onClose();
    } catch (lookupError) {
      setError(
        lookupError instanceof Error ? lookupError.message : 'Unable to retrieve memberships.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={mode !== null} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          {isUserLookup
            ? '选择多个用户，查看其直接分配的安全角色。'
            : '选择多个安全角色，查看直接分配该角色的用户。'}
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
          loading={isSearching}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box>
                <Typography variant='body2'>{option.label}</Typography>
                {option.detail && (
                  <Typography variant='caption' color='text.secondary'>
                    {option.detail}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              label={inputLabel}
              placeholder='输入至少两个字符'
              helperText='输入关键字后从搜索结果中多选。最多可选择 100 项。'
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
        <Button onClick={onClose}>关闭</Button>
        <Button
          variant='contained'
          onClick={handleViewMemberships}
          disabled={isLoading || selected.length === 0}
        >
          {isLoading ? '正在查询...' : '查看关系'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SecurityRoleMembershipDialog;
