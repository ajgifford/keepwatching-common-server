export function buildTMDBImagePath(path: string, size: string = 'w185'): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function buildDefaultImagePath(name: string): string {
  const formattedName = replaceSpacesWithPlus(name);
  return `https://placehold.co/300x200/42a5f5/white?text=${formattedName}&font=roboto`;
}

function replaceSpacesWithPlus(input: string): string {
  return input.replace(/ /g, '+');
}

export function buildAccountImageName(id: string, mimetype: string) {
  const extArray = mimetype.split('/');
  const extension = extArray[extArray.length - 1];
  return `accountImage_${id}_${Date.now()}.${extension}`;
}

export function buildProfileImageName(id: string, mimetype: string) {
  const extArray = mimetype.split('/');
  const extension = extArray[extArray.length - 1];
  return `profileImage_${id}_${Date.now()}.${extension}`;
}

export function getPhotoForGoogleAccount(name: string, photoURL: string | undefined, image: string | undefined) {
  if (image) {
    return buildUploadedImageURL(image, 'accounts');
  }
  if (photoURL) {
    return photoURL;
  }
  return buildDefaultImagePath(name);
}

export function getAccountImage(image: string | null | undefined, name: string) {
  return getImage(image, name, 'accounts');
}

export function getProfileImage(image: string | null | undefined, name: string) {
  return getImage(image, name, 'profiles');
}

function getImage(image: string | null | undefined, name: string, folder: string) {
  if (image) {
    return buildUploadedImageURL(image, folder);
  }
  return buildDefaultImagePath(name);
}

function buildUploadedImageURL(image: string, folder: string) {
  return `/uploads/${folder}/${image}`;
}
