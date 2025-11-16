async function getItemsfromDB(){
  try {
    const response = await fetch(window.getApiUrl('api/items'));
    const data = await response.json();
    console.log('API Data: ', data);
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}