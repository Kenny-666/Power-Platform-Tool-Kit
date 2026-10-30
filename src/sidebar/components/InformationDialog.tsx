import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Info as InfoIcon,
  Star as StarIcon,
  Code as CodeIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { formActions, debuggingActions, navigationActions } from '../config/actions';
import { useLocalization } from '#localization/LocalizationContext';

interface InformationDialogProps {
  open: boolean;
  onClose: () => void;
}

const InformationDialog: React.FC<InformationDialogProps> = ({ open, onClose }) => {
  const { t } = useLocalization();
  const [stats, setStats] = useState<any>(null);

  // Helper function to get readable action names
  const getActionDisplayName = (actionId: string) => {
    // Combine all action configs
    const allActions = [...formActions, ...debuggingActions, ...navigationActions];

    // Find the action config by ID
    const actionConfig = allActions.find(action => action.id === actionId);

    // Return the label if found, otherwise fall back to formatting the ID
    return (
      actionConfig?.label ||
      actionId
        .split(':')[1]
        ?.replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()) ||
      actionId
    );
  };

  // Helper function to format time since last use
  const formatTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  // Load stats from localStorage
  useEffect(() => {
    if (open) {
      const loadStats = () => {
        try {
          // Recently used actions
          const recentActions = JSON.parse(localStorage.getItem('levelup-recent-actions') || '[]');

          // Keep only events from the last 7 days (weekly reset)
          const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
          const cutoff = Date.now() - ONE_WEEK_MS;
          const recentActionsFiltered = (recentActions || []).filter(
            (a: any) => (a.timestamp || 0) >= cutoff
          );

          // Persist the cleaned recent actions back to localStorage so stats are effectively reset weekly
          try {
            localStorage.setItem('levelup-recent-actions', JSON.stringify(recentActionsFiltered));
          } catch (e) {
            // ignore storage errors
          }

          // Use the filtered list for all further calculations
          const actionsToUse = recentActionsFiltered;

          // Favorites
          const favorites = JSON.parse(localStorage.getItem('levelup-favorites') || '[]');

          // Custom commands
          const customCommands = JSON.parse(
            localStorage.getItem('levelup-custom-commands') || '[]'
          );

          // Extension config
          const config = JSON.parse(localStorage.getItem('levelup-extension-config') || '{}');

          // Calculate total action usage
          const totalUsage = actionsToUse.reduce(
            (sum: number, action: any) => sum + (action.count || 0),
            0
          );

          // Calculate unique actions used
          const uniqueActions = actionsToUse.length;

          // Get top 3 most used actions with display names and time info
          const topActions = actionsToUse
            .slice() // copy so sort doesn't mutate original
            .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
            .slice(0, 3)
            .map((action: any) => ({
              id: action.id,
              displayName: getActionDisplayName(action.id),
              count: action.count || 0,
              lastUsed: action.timestamp,
              timeSince: formatTimeSince(action.timestamp),
            }));

          // Calculate average usage per week (simplified)
          if (!actionsToUse || actionsToUse.length === 0) {
            setStats({
              totalUsage: 0,
              uniqueActions: 0,
              topActions: [],
              avgUsagePerWeek: 0,
            });
            return;
          }

          // Determine tracking period based on earliest timestamp in the filtered actions
          const earliest = Math.min(...actionsToUse.map((a: any) => a.timestamp || Date.now()));
          const trackingDays = Math.max(
            1,
            Math.ceil((Date.now() - earliest) / (1000 * 60 * 60 * 24))
          );
          const trackingWeeks = Math.max(1, Math.ceil(trackingDays / 7));
          const avgUsagePerWeek = (totalUsage / trackingWeeks).toFixed(1);

          setStats({
            totalUsage,
            uniqueActions,
            topActions,
            avgUsagePerWeek: parseFloat(avgUsagePerWeek),
          });
        } catch (error) {
          console.error('Error loading stats:', error);
          setStats(null);
        }
      };

      loadStats();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 2,
          minHeight: '45vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon color='primary' />
            <Typography variant='h6'>{t('statsForNerds')}</Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size='small'
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 0 }}>
        <Box sx={{ px: 3, py: 2 }}>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant='h6'
                sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CodeIcon color='primary' />
                {t('actionStatistics')}
              </Typography>
              <Alert severity='info' sx={{ mb: 2 }}>
                <Typography variant='body2'>
                  <SecurityIcon sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'middle' }} />
                  All statistics are stored locally on your device and are never transmitted or
                  shared.
                </Typography>
              </Alert>
            </Box>

            {stats ? (
              <>
                {/* Key Metrics */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Card
                      sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', height: 80 }}
                    >
                      <CardContent
                        sx={{
                          textAlign: 'center',
                          py: 1.5,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          '&:last-child': { pb: 1.5 },
                        }}
                      >
                        <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {stats.totalUsage}
                        </Typography>
                        <Typography variant='caption' sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          {t('totalActions')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Card
                      sx={{ bgcolor: 'success.main', color: 'success.contrastText', height: 80 }}
                    >
                      <CardContent
                        sx={{
                          textAlign: 'center',
                          py: 1.5,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          '&:last-child': { pb: 1.5 },
                        }}
                      >
                        <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {stats.uniqueActions}
                        </Typography>
                        <Typography variant='caption' sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          {t('uniqueActions')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Card
                      sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', height: 80 }}
                    >
                      <CardContent
                        sx={{
                          textAlign: 'center',
                          py: 1.5,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          '&:last-child': { pb: 1.5 },
                        }}
                      >
                        <Typography variant='h5' sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {stats.avgUsagePerWeek}
                        </Typography>
                        <Typography variant='caption' sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Avg/Week
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>

                {/* Top Actions */}
                {stats.topActions && stats.topActions.length > 0 && (
                  <Card>
                    <CardContent sx={{ py: 2 }}>
                      <Typography
                        variant='subtitle2'
                        sx={{
                          fontWeight: 600,
                          mb: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <TrendingUpIcon color='primary' fontSize='small' />
                        Most Popular Actions
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {stats.topActions.map((action: any, index: number) => (
                          <Box
                            key={action.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1,
                              bgcolor: index === 0 ? 'primary.main' : 'action.hover',
                              color: index === 0 ? 'primary.contrastText' : 'text.primary',
                              borderRadius: 1,
                              minHeight: '36px',
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <Typography
                                variant='body2'
                                sx={{
                                  minWidth: '20px',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                }}
                              >
                                #{index + 1}
                              </Typography>
                              <Typography
                                variant='body2'
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '0.85rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                              >
                                {action.displayName}
                              </Typography>
                            </Box>
                            <Box
                              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
                            >
                              <Typography
                                variant='caption'
                                sx={{
                                  fontSize: '0.7rem',
                                  opacity: index === 0 ? 0.9 : 0.7,
                                }}
                              >
                                {action.timeSince}
                              </Typography>
                              <Typography
                                variant='body2'
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  minWidth: '35px',
                                  textAlign: 'right',
                                }}
                              >
                                {action.count}×
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>{t('loadingStatistics')}</Typography>
              </Box>
            )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant='contained' sx={{ minWidth: 100 }}>
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InformationDialog;
