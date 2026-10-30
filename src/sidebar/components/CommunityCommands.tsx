import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  Person as AuthorIcon,
  CalendarToday as DateIcon,
  Category as CategoryIcon,
  Tag as TagIcon,
  GitHub as GitHubIcon,
  Launch as LaunchIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  CloudDownload as InstallIcon,
} from '@mui/icons-material';
import { githubApiService } from '#services/GitHubApiService';
import { CustomCommandsService } from '#services/CustomCommandsService';
import { useLocalization } from '#localization/LocalizationContext';

interface CommunityCommand {
  title: string;
  url: string;
  state: string;
  labels: string[];
  createdAt: string;
  author: string;
  body?: string;
  metadata?: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    code?: string;
  };
}

interface CommunityCommandsProps {
  onToast: (message: string, severity: 'success' | 'info' | 'warning' | 'error') => void;
}

const CommunityCommands: React.FC<CommunityCommandsProps> = ({ onToast }) => {
  const { t } = useLocalization();
  const [commands, setCommands] = useState<CommunityCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    command: CommunityCommand | null;
  }>({ open: false, command: null });
  const [installing, setInstalling] = useState<string | null>(null);

  const categories = [
    'form-actions',
    'navigation-actions',
    'admin-actions',
    'debugging-actions',
    'view-actions',
    'data-manipulation',
    'reporting',
    'automation',
    'utilities',
    'miscellaneous',
  ];

  // Load community commands on mount
  useEffect(() => {
    loadCommunityCommands();
  }, []);

  const loadCommunityCommands = async () => {
    setLoading(true);
    try {
      const result = await githubApiService.searchCommands('new-command');

      if (result.success && result.commands) {
        // Process the commands to extract metadata
        const processedCommands = result.commands.map(command => ({
          ...command,
          metadata: parseCommandMetadata(command),
        }));

        setCommands(processedCommands);
        onToast(t('foundCommunityCommands', { count: processedCommands.length }), 'info');
      } else {
        onToast(t('loadCommunityCommandsFailed', { error: result.error || t('unknownError') }), 'error');
      }
    } catch (error) {
      console.error('Failed to load community commands:', error);
      onToast(t('connectCommunityRepositoryFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const parseCommandMetadata = (command: any): any => {
    // This would parse the GitHub issue body to extract command metadata
    // For now, return basic parsing based on title and labels

    const categoryLabel = command.labels.find((label: string) => label.startsWith('category:'));
    const tagLabels = command.labels.filter((label: string) => label.startsWith('tag:'));

    return {
      name: command.title.replace('New Command: ', ''),
      category: categoryLabel ? categoryLabel.replace('category:', '') : 'miscellaneous',
      tags: tagLabels.map((tag: string) => tag.replace('tag:', '')),
      description: t('communityDefaultDescription'),
    };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadCommunityCommands();
      return;
    }

    setLoading(true);
    try {
      const result = await githubApiService.searchCommands(searchQuery);

      if (result.success && result.commands) {
        const processedCommands = result.commands.map(command => ({
          ...command,
          metadata: parseCommandMetadata(command),
        }));

        setCommands(processedCommands);
      } else {
        onToast(t('communitySearchFailed', { error: result.error || t('unknownError') }), 'error');
      }
    } catch (error) {
      onToast(t('communitySearchFailed', { error: t('unknownError') }), 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCommands = commands.filter(command => {
    if (selectedCategory && command.metadata?.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const handlePreviewCommand = (command: CommunityCommand) => {
    setPreviewDialog({ open: true, command });
  };

  const handleInstallCommand = async (command: CommunityCommand) => {
    if (!command.metadata?.name) {
      onToast(t('cannotInstallMissingMetadata'), 'error');
      return;
    }

    setInstalling(command.url);

    try {
      // For now, create a placeholder command
      // In a real implementation, you would fetch the full issue content
      // and parse the JavaScript code from the issue body

      const commandData = {
        name: command.metadata.name,
        description: command.metadata.description || t('communityDefaultDescription'),
        category: command.metadata.category,
        tags: command.metadata.tags || [],
        code: `// Community command: ${command.metadata.name}
// Source: ${command.url}
// TODO: Implement the actual command code

console.log('This is a placeholder for the community command');
console.log('Visit the GitHub issue to see the full implementation: ${command.url}');

// Example command structure:
function ${command.metadata.name.replace(/\s+/g, '')}() {
  try {
    // Command implementation goes here
    console.log('Community command executed successfully');
  } catch (error) {
    console.error('Command execution failed:', error);
  }
}

// Execute the command
${command.metadata.name.replace(/\s+/g, '')}();`,
        icon: 'cloud_download',
      };

      const newCommand = await CustomCommandsService.createCommand(commandData);
      onToast(t('commandInstalled', { name: command.metadata.name }), 'success');
    } catch (error) {
      console.error('Failed to install command:', error);
      onToast(t('commandInstallFailed'), 'error');
    } finally {
      setInstalling(null);
    }
  };

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display='flex' justifyContent='space-between' alignItems='center' mb={2}>
            <Typography variant='h6' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GitHubIcon />
              {t('communityCommands')}
            </Typography>
            <Tooltip title={t('refreshCommands')}>
              <IconButton onClick={loadCommunityCommands} disabled={loading} size='small'>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Search and Filters */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size='small'
              placeholder={t('searchCommunityCommands')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position='end'>
                    <Button onClick={handleSearch} size='small' disabled={loading}>
                      {t('search')}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            {/* Category Filter */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip
                label={t('allCategories')}
                variant={selectedCategory === '' ? 'filled' : 'outlined'}
                onClick={() => setSelectedCategory('')}
                size='small'
              />
              {categories.map(category => (
                <Chip
                  key={category}
                  label={category
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                  variant={selectedCategory === category ? 'filled' : 'outlined'}
                  onClick={() => setSelectedCategory(category)}
                  size='small'
                />
              ))}
            </Box>
          </Box>

          {/* Commands List */}
          {loading ? (
            <Box display='flex' justifyContent='center' py={4}>
              <CircularProgress />
            </Box>
          ) : commands.length === 0 ? (
            <Alert severity='info'>
              <Typography variant='body2'>
                {t('noCommunityCommands')}
              </Typography>
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredCommands.map((command, index) => (
                <Accordion key={command.url} variant='outlined'>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                      <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                        {command.metadata?.name || command.title}
                      </Typography>
                      <Box
                        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}
                      >
                        <Chip
                          icon={<CategoryIcon />}
                          label={command.metadata?.category || 'uncategorized'}
                          size='small'
                          variant='outlined'
                        />
                        <Chip
                          icon={<AuthorIcon />}
                          label={command.author}
                          size='small'
                          variant='outlined'
                        />
                        <Chip
                          icon={<DateIcon />}
                          label={new Date(command.createdAt).toLocaleDateString()}
                          size='small'
                          variant='outlined'
                        />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant='body2' color='text.secondary'>
                        {command.metadata?.description || t('noDescriptionAvailable')}
                      </Typography>

                      {command.metadata?.tags && command.metadata.tags.length > 0 && (
                        <Box>
                          <Typography
                            variant='caption'
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                          >
                            <TagIcon fontSize='small' />
                            {t('tags')}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {command.metadata.tags.map(tag => (
                              <Chip key={tag} label={tag} size='small' />
                            ))}
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size='small'
                          variant='outlined'
                          startIcon={<CodeIcon />}
                          onClick={() => handlePreviewCommand(command)}
                        >
                          {t('preview')}
                        </Button>
                        <Button
                          size='small'
                          variant='contained'
                          startIcon={
                            installing === command.url ? (
                              <CircularProgress size={16} />
                            ) : (
                              <InstallIcon />
                            )
                          }
                          onClick={() => handleInstallCommand(command)}
                          disabled={installing === command.url}
                        >
                          {installing === command.url ? t('installing') : t('install')}
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          startIcon={<LaunchIcon />}
                          href={command.url}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {t('viewOnGitHub')}
                        </Button>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Command Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, command: null })}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>{t('commandPreview', { name: previewDialog.command?.metadata?.name ?? '' })}</DialogTitle>
        <DialogContent>
          <Alert severity='info' sx={{ mb: 2 }}>
            <Typography variant='body2'>{t('communityPreviewDescription')}</Typography>
          </Alert>

          {previewDialog.command && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant='body2'>
                <strong>{t('communityDescription')}</strong> {previewDialog.command.metadata?.description}
              </Typography>
              <Typography variant='body2'>
                <strong>{t('category')}</strong> {previewDialog.command.metadata?.category}
              </Typography>
              <Typography variant='body2'>
                <strong>{t('author')}</strong> {previewDialog.command.author}
              </Typography>

              <Link
                href={previewDialog.command.url}
                target='_blank'
                rel='noopener noreferrer'
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <GitHubIcon fontSize='small' />
                {t('viewFullDetailsOnGitHub')}
                <LaunchIcon fontSize='small' />
              </Link>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog({ open: false, command: null })}>{t('close')}</Button>
          {previewDialog.command && (
            <Button
              variant='contained'
              startIcon={<InstallIcon />}
              onClick={() => {
                handleInstallCommand(previewDialog.command!);
                setPreviewDialog({ open: false, command: null });
              }}
            >
              {t('installCommand')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CommunityCommands;
