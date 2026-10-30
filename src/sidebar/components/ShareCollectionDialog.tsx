import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Box,
  Typography,
  TextField,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
} from '@mui/material';
import {
  Collections as CollectionIcon,
  Code as CodeIcon,
  Share as ShareIcon,
  CheckCircle as SuccessIcon,
  GitHub as GitHubIcon,
  Send as SendIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { CustomCommand } from '#types/custom-commands';
import { ShareCollectionData } from '#services/GitHubApiService';
import { useLocalization } from '#localization/LocalizationContext';

interface ShareCollectionDialogProps {
  open: boolean;
  commands: CustomCommand[];
  onShare: (collectionData: ShareCollectionData) => Promise<void>;
  onClose: () => void;
}

const commonTags = [
  'workflow',
  'automation',
  'reporting',
  'data-migration',
  'integration',
  'productivity',
  'business-process',
  'data-management',
  'ui-enhancement',
  'analytics',
  'user-management',
  'development',
  'utilities',
];


const ShareCollectionDialog: React.FC<ShareCollectionDialogProps> = ({
  open,
  commands,
  onShare,
  onClose,
}) => {
  const { t } = useLocalization();
  const steps = [t('selectCommands'), t('collectionDetails'), t('safetyQuality'), t('previewShare')];
  const categories = [
    { value: 'Form Actions', label: t('categoryFormActions') }, { value: 'Navigation', label: t('categoryNavigation') },
    { value: 'Data Management', label: t('categoryDataManagement') }, { value: 'UI Enhancement', label: t('categoryUiEnhancement') },
    { value: 'Development Tools', label: t('categoryDevelopmentTools') }, { value: 'Workflow Automation', label: t('categoryWorkflowAutomation') },
    { value: 'Reporting & Analytics', label: t('categoryReportingAnalytics') }, { value: 'User Management', label: t('categoryUserManagement') },
    { value: 'Business Process', label: t('categoryBusinessProcess') }, { value: 'Other', label: t('categoryOther') },
  ];
  const dynamicsVersions = [
    { value: 'Any', label: t('versionAny') }, { value: 'Dynamics 365 Online', label: t('versionDynamicsOnline') },
    { value: 'Dynamics 365 (on-premises)', label: t('versionDynamicsOnPremises') }, { value: 'Power Platform', label: t('versionPowerPlatform') },
    { value: 'Dynamics 365 Customer Engagement', label: t('versionCustomerEngagement') }, { value: 'Dynamics 365 Finance & Operations', label: t('versionFinanceOperations') },
    { value: 'Version 9.2+', label: t('version92') },
  ];
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCommands, setSelectedCommands] = useState<Set<string>>(new Set());
  const [collectionName, setCollectionName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dynamicsVersion, setDynamicsVersion] = useState('Any');
  const [contactInfo, setContactInfo] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareComplete, setShareComplete] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Safety checklist state
  const [safetyChecklist, setSafetyChecklist] = useState({
    tested: false,
    noSensitiveData: false,
    bestPractices: false,
    confirmations: false,
    publicLicense: false,
  });

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setActiveStep(0);
      setSelectedCommands(new Set());
      setCollectionName('');
      setDescription('');
      setCategory('');
      setAuthor('');
      setTags([]);
      setDynamicsVersion('Any');
      setContactInfo('');
      setIsSharing(false);
      setShareComplete(false);
      setErrors([]);
      setSafetyChecklist({
        tested: false,
        noSensitiveData: false,
        bestPractices: false,
        confirmations: false,
        publicLicense: false,
      });
    }
  }, [open]);

  const handleCommandToggle = (commandId: string) => {
    const newSelected = new Set(selectedCommands);
    if (newSelected.has(commandId)) {
      newSelected.delete(commandId);
    } else {
      newSelected.add(commandId);
    }
    setSelectedCommands(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCommands.size === commands.length) {
      setSelectedCommands(new Set());
    } else {
      setSelectedCommands(new Set(commands.map(cmd => cmd.id)));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: string[] = [];

    switch (step) {
      case 0: // Select Commands
        if (selectedCommands.size === 0) {
          newErrors.push(t('selectCommandRequired'));
        }
        break;
      case 1: // Collection Details
        if (!collectionName.trim()) {
          newErrors.push(t('collectionNameRequired'));
        }
        if (!description.trim()) {
          newErrors.push(t('collectionDescriptionRequired'));
        } else if (description.length < 20) {
          newErrors.push(t('descriptionMinimum'));
        }
        if (!author.trim()) {
          newErrors.push(t('authorNameRequired'));
        }
        if (!category.trim()) {
          newErrors.push(t('categoryRequired'));
        }
        break;
      case 2: // Safety & Quality
        const requiredChecks = Object.values(safetyChecklist);
        if (!requiredChecks.every(checked => checked)) {
          newErrors.push(t('checklistRequired'));
        }
        break;
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const buildGitHubIssueUrl = () => {
    const baseUrl =
      'https://github.com/rajyraman/level-up-community-commands/issues/new?template=share-command-collection.yml';
    const params = new URLSearchParams();

    if (collectionName.trim()) params.set('collection-name', collectionName.trim());
    if (description.trim()) params.set('description', description.trim());
    if (category.trim()) params.set('category', category.trim());
    if (tags.length > 0) params.set('tags', tags.join(', '));
    if (dynamicsVersion.trim()) params.set('dynamics-version', dynamicsVersion.trim());
    if (author.trim()) params.set('author-attribution', author.trim());
    if (contactInfo.trim()) params.set('contact-info', contactInfo.trim());

    // Add command count
    params.set('command-count', selectedCommands.size.toString());

    // Add commands JSON
    if (selectedCommands.size > 0) {
      const selectedCommandsList = commands.filter(cmd => selectedCommands.has(cmd.id));
      const commandsJson = JSON.stringify(
        {
          version: '1.0.0',
          exportedAt: Date.now(),
          commands: selectedCommandsList,
        },
        null,
        2
      );
      params.set('commands-json', commandsJson);
    }

    return `${baseUrl}&${params.toString()}`;
  };

  const handleShare = async () => {
    if (!validateStep(activeStep)) return;

    setIsSharing(true);
    try {
      const selectedCommandsList = commands.filter(cmd => selectedCommands.has(cmd.id));

      const collectionData: ShareCollectionData = {
        collectionName: collectionName.trim(),
        description: description.trim(),
        category: category.trim(),
        author: author.trim(),
        tags: tags,
        dynamicsVersion: dynamicsVersion.trim(),
        setupInstructions: '',
        commandCount: selectedCommandsList.length,
        commandsJson: JSON.stringify(
          {
            version: '1.0.0',
            exportedAt: Date.now(),
            commands: selectedCommandsList,
          },
          null,
          2
        ),
        workflowDiagram: undefined,
        contactInfo: contactInfo.trim() || undefined,
      };

      await onShare(collectionData);
      setShareComplete(true);
      setActiveStep(steps.length); // Move to success step
    } catch (error) {
      setErrors([t('failedShareCollection', { error: (error as Error).message })]);
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Select Commands
        return (
          <Box>
            <Typography variant='body2' color='text.secondary' mb={2}>
              {t('selectCommandsDescription')}
            </Typography>

            <Box mb={2}>
              <Button
                variant='outlined'
                size='small'
                onClick={handleSelectAll}
                startIcon={<CollectionIcon />}
              >
                {selectedCommands.size === commands.length ? t('deselectAll') : t('selectAll')}
              </Button>
              <Typography variant='body2' color='text.secondary' mt={1}>
                {t('commandsSelected', { selected: selectedCommands.size, total: commands.length })}
              </Typography>
            </Box>

            <FormGroup>
              {commands.map(command => (
                <Card key={command.id} variant='outlined' sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedCommands.has(command.id)}
                          onChange={() => handleCommandToggle(command.id)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant='subtitle2'>{command.name}</Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {command.description || t('noDescription')}
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', m: 0 }}
                    />
                  </CardContent>
                </Card>
              ))}
            </FormGroup>
          </Box>
        );

      case 1: // Collection Details
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label={t('collectionName')}
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              placeholder={t('collectionNamePlaceholder')}
              helperText={t('collectionNameHelp')}
              required
            />

            <TextField
              fullWidth
              label={t('collectionDescription')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={3}
              placeholder={t('collectionDescriptionPlaceholder')}
              helperText={t('collectionDescriptionHelp')}
              required
            />

            <FormControl fullWidth required>
              <InputLabel>{t('primaryCategory')}</InputLabel>
              <Select
                value={category}
                onChange={e => setCategory(e.target.value)}
                label={t('primaryCategory')}
              >
                {categories.map(categoryOption => (
                  <MenuItem key={categoryOption.value} value={categoryOption.value}>
                    {categoryOption.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{t('categoryHelp')}</FormHelperText>
            </FormControl>

            <TextField
              fullWidth
              label={t('authorName')}
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder={t('authorPlaceholder')}
              helperText={t('authorHelp')}
              required
            />

            <Autocomplete
              multiple
              options={commonTags}
              value={tags}
              onChange={(_, newValue) => setTags(newValue)}
              freeSolo
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant='outlined'
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('collectionTags')}
                  placeholder={t('tagsPlaceholder')}
                  helperText={t('tagsHelp')}
                />
              )}
            />

            <FormControl fullWidth>
              <InputLabel>{t('dynamicsVersion')}</InputLabel>
              <Select
                value={dynamicsVersion}
                onChange={e => setDynamicsVersion(e.target.value)}
                label={t('dynamicsVersion')}
              >
                {dynamicsVersions.map(versionOption => (
                  <MenuItem key={versionOption.value} value={versionOption.value}>
                    {versionOption.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {t('dynamicsVersionHelp')}
              </FormHelperText>
            </FormControl>
          </Box>
        );

      case 2: // Safety & Quality
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity='info' icon={<SecurityIcon />}>
              <Typography variant='body2'>
                {t('safetyReview')}
              </Typography>
            </Alert>

            <TextField
              fullWidth
              label={t('contactInformation')}
              value={contactInfo}
              onChange={e => setContactInfo(e.target.value)}
              placeholder={t('contactPlaceholder')}
              helperText={t('contactHelp')}
            />

            <Typography variant='subtitle1' sx={{ mt: 2, mb: 1 }}>
              {t('safetyChecklist')}
            </Typography>

            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safetyChecklist.tested}
                    onChange={e =>
                      setSafetyChecklist(prev => ({ ...prev, tested: e.target.checked }))
                    }
                  />
                }
                label={t('checklistTested')}
                required
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safetyChecklist.noSensitiveData}
                    onChange={e =>
                      setSafetyChecklist(prev => ({ ...prev, noSensitiveData: e.target.checked }))
                    }
                  />
                }
                label={t('checklistSensitiveData')}
                required
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safetyChecklist.bestPractices}
                    onChange={e =>
                      setSafetyChecklist(prev => ({ ...prev, bestPractices: e.target.checked }))
                    }
                  />
                }
                label={t('checklistBestPractices')}
                required
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safetyChecklist.confirmations}
                    onChange={e =>
                      setSafetyChecklist(prev => ({ ...prev, confirmations: e.target.checked }))
                    }
                  />
                }
                label={t('checklistConfirmations')}
                required
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={safetyChecklist.publicLicense}
                    onChange={e =>
                      setSafetyChecklist(prev => ({ ...prev, publicLicense: e.target.checked }))
                    }
                  />
                }
                label={t('checklistLicense')}
                required
              />
            </FormGroup>
          </Box>
        );

      case 3: // Preview & Share
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity='info' sx={{ mb: 2 }}>
              <Typography variant='body2'>
                {t('shareReview')}
              </Typography>
            </Alert>

            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  <CollectionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {t('collectionPreview')}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                  <Typography variant='body2'>
                    <strong>{t('previewName')}</strong> {collectionName}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>{t('previewCategory')}</strong> {category}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>{t('previewAuthor')}</strong> {author}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>{t('previewVersion')}</strong> {dynamicsVersion}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>{t('previewCommands')}</strong> {t('selected', { count: selectedCommands.size })}
                  </Typography>
                </Box>

                <Typography variant='body2' paragraph>
                  <strong>{t('previewDescription')}</strong> {description}
                </Typography>

                {tags.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant='body2' sx={{ mb: 1 }}>
                      <strong>{t('previewTags')}</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {tags.map(tag => (
                        <Chip key={tag} label={tag} size='small' variant='outlined' />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Typography variant='subtitle2' mb={1}>
              {t('includedCommands')}
            </Typography>
            <List dense>
              {commands
                .filter(cmd => selectedCommands.has(cmd.id))
                .map(command => (
                  <ListItem key={command.id}>
                    <ListItemIcon>
                      <CodeIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText
                      primary={command.name}
                      secondary={command.description || t('noDescription')}
                    />
                  </ListItem>
                ))}
            </List>
          </Box>
        );

      default:
        return null;
    }
  };

  // Success state
  if (shareComplete) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant='h5' gutterBottom>
            {t('collectionSharedTitle')}
          </Typography>
          <Typography variant='body1' color='text.secondary' paragraph>
            {t('collectionSharedDescription')}
          </Typography>
          <Button
            variant='outlined'
            startIcon={<GitHubIcon />}
            href={buildGitHubIssueUrl()}
            target='_blank'
            rel='noopener noreferrer'
            sx={{ mb: 2 }}
          >
            {t('openGitHubIssueForm')}
          </Button>
          <Box>
            <Button onClick={handleClose} variant='contained'>
              {t('close')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='md'
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' },
      }}
    >
      <DialogTitle>
        <Box display='flex' alignItems='center' gap={1}>
          <ShareIcon />
          {t('commandShareTitle')}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation='vertical'>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {renderStepContent(index)}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {index > 0 && (
                    <Button onClick={handleBack} variant='outlined'>
                      {t('back')}
                    </Button>
                  )}
                  {index < steps.length - 1 ? (
                    <Button onClick={handleNext} variant='contained'>
                      {t('next')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleShare}
                      variant='contained'
                      disabled={isSharing || selectedCommands.size === 0}
                      startIcon={isSharing ? <CircularProgress size={20} /> : <SendIcon />}
                    >
                      {isSharing ? t('openingGitHub') : t('openGitHubIssueForm')}
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {errors.length > 0 && (
          <Alert severity='error' sx={{ mt: 2 }}>
            {errors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSharing}>
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareCollectionDialog;
